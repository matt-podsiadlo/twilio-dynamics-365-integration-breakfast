import React from 'react';
import { VERSION } from '@twilio/flex-ui';
import { FlexPlugin } from 'flex-plugin';

import CustomTaskListContainer from './components/CustomTaskList/CustomTaskList.Container';
import reducers, { namespace } from './states';

const PLUGIN_NAME = 'DynamicsFlexPlugin';
const DYNAMICS_ORG = 'flyowl.crm4.dynamics.com';

export default class DynamicsFlexPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started
   * Use this to modify any UI components or attach to the actions framework
   *
   * @param flex { typeof import('@twilio/flex-ui') }
   * @param manager { import('@twilio/flex-ui').Manager }
   */
  init(flex, manager) {
    this.registerReducers(manager);

    const loadjs = require("loadjs");
    loadjs(`https://${DYNAMICS_ORG}/webresources/Widget/msdyn_ciLibrary.js`, 'CIF', {
      before: function (path, scriptEl) {
        // Required to properly load the library, ref: https://docs.microsoft.com/en-us/dynamics365/customer-service/channel-integration-framework/pass-url-widget-library
        scriptEl.setAttribute('data-cifid', 'CIFMainLibrary');
        scriptEl.setAttribute('data-crmurl', `https://${DYNAMICS_ORG}`);

        // console.log('LoadJS Before', path, scriptEl);
      }
    });


    loadjs.ready('CIF', function () {
      console.log('CIF library is ready.');
      console.log('Window Microsoft: ', window.Microsoft);

      window.Microsoft.CIFramework.addHandler("onclicktoact", function (event) {
        // your code for what flex should do when the click event happens in dynamics
        let eventData = JSON.parse(event);
        if (eventData.name == 'mobilephone') {
          console.log(`Requesting an outbound call to ${eventData.value}`);
          flex.Actions.invokeAction("StartOutboundCall", {
            destination: eventData.value
          });
        } else console.log('Unhandled onclicktoact event type: ', eventData)
      });


    });

    function screenPop(contactno, caseNumber, incidentID) {
      panel(1);
      if ((caseNumber !== '') && (!caseNumber !== null)) {
        // retrieve contact record
        window.Microsoft.CIFramework.searchAndOpenRecords('incident', `?$select=ticketnumber,title&$search=${caseNumber}&$top=1&$filter=incidentid eq ${incidentID}`, false)
      } else {
        window.Microsoft.CIFramework.searchAndOpenRecords('contact', `?$select=name,telephone1&$filter=telephone1 eq '${contactno}'&$search=${contactno}`, false)
      }
    }

    function panel(mode) {
      window.Microsoft.CIFramework.setMode(mode);
    }

    const options = { sortOrder: -1 };

    // Default demo component:
    // flex.AgentDesktopView
    //   .Panel1
    //   .Content
    //   .add(<CustomTaskListContainer key="DynamicsFlexPlugin-component" />, options);

    flex.AgentDesktopView.defaultProps.showPanel2 = false;
    flex.MainContainer.defaultProps.keepSideNavOpen = true;

    flex.Actions.addListener("afterSelectTask", (payload) => {
      // Do some screen popping when an agent selects a task
      let task = payload.task;
      if (task) {
        let incidentID = `${task.attributes.incidentID}`; // The incident ID in dynamics
        let caseNumber = `${task.attributes.caseNumber}`; // The case number to be searched
        let contactno = `${task.attributes.from}`; // The contact number to be searched

        if (task.attributes.direction !== 'outbound') {
          screenPop(contactno, caseNumber, incidentID)
        }
        else {
          panel(1);
        }
      } else console.warn('Task does not exist anymore.');
    });

    flex.Actions.addListener("afterCompleteTask", (payload) => {
      // Record a phonecall timeline event when task finishes
      console.log('afterCompleteTask', payload);
      let task = payload.task;
      if (task) {
        console.log('Channel: ', task.channelType);
        Microsoft.CIFramework.getEnvironment().then(
          function success(env) {
            let envObject = JSON.parse(env)
            console.log('Dynamics environment: ', envObject);
            let incidentID = (task.attributes.incidentID) ? `${task.attributes.incidentID}` : envObject.id; // `${task.attributes.incidentID}`; // The incident ID in dynamics
            let customerID = (task.attributes.contact_id) ? `${task.attributes.contact_id}` : '4da0e5b9-88df-e311-b8e5-6c3be5a8b200' // The customer ID in dynamics, hardcoding one as a fallback for now, add sth like getIncidentOwner(incidentID) later
            let userID = envObject.userId.substring(1, envObject.userId.length - 1) // it comes enclosed in {}, so need to remove them

            let from = {
              'participationtypemask': 1
            }
            let to = {
              'participationtypemask': 2
            }
            let direction;
            let subject;

            if (task.channelType == 'voice') {
              if (task.attributes.type !== undefined && task.attributes.type == 'inbound') {
                // This was an inbound call
                subject = 'Inbound call';
                from['partyid_contact@odata.bind'] = `/contacts(${customerID})`;
                to['partyid_systemuser@odata.bind'] = `/systemusers(${userID})`;
                direction = false;
              } else {
                // This was an outbound call
                subject = 'Outbound call';
                from['partyid_systemuser@odata.bind'] = `/systemusers(${userID})`;
                to['partyid_contact@odata.bind'] = `/contacts(${customerID})`;
                direction = true;
              }

              let jsonData = {
                'directioncode': direction,
                'subject': subject,
                'phonecall_activity_parties': [from, to],
                'regardingobjectid_incident@odata.bind': `/incidents(${incidentID})`
              }

              console.log('Attempting to create a timeline event...', jsonData);
              Microsoft.CIFramework.createRecord("phonecall", JSON.stringify(jsonData)).then(
                function success(result) {
                  let data = JSON.parse(result);
                  console.log('Timeline event creation success!', data);
                },
                function (error) {
                  console.error('Timeline event creation error: ', error);
                }
              );
            } else if (task.channelType == 'sms') {
              // For the purpose of this demo, hard coded transcript data is logged. In a real scenario, you would use the chat channel SID available in the task attributes to get conversation history from Twilio.
              // https://www.twilio.com/docs/chat/rest/message-resource#read-multiple-message-resources
              let jsonData = {
                'isdocument': false,
                'subject': 'Inbound SMS conversation',
                'notetext': `From: Brian Wayne
                Hello, any updates on my refund case?
                 
                From: CH3e6c61d62e93484db06515befc0f718e
                Hello Brian. This is your friendly FlyOwl Support bot. I see that you have (1) case open at the moment (01000-D3K4W3). Let me connect you to an Agent.
                 
                From: Matt Podsiadlo
                Hello Brian, my name is Matt, your case is almost resolved, I will call you shortly with more details.
                
                From: Brian Wayne
                Ok`,
                'objectid_incident@odata.bind': `/incidents(${incidentID})`
              };

              console.log('Attempting to create an Annotation timeline event...', jsonData);
              Microsoft.CIFramework.createRecord("annotation", JSON.stringify(jsonData)).then(
                function success(result) {
                  let data = JSON.parse(result);
                  console.log('Annotation timeline event creation success!', data);
                },
                function (error) {
                  console.error('Annotation timeline event creation error: ', error);
                }
              );              
            } else console.log('Unhandled task channel type: ', task.channelType)
          },
          function (error) {
            console.error('There was an error retrieving current Dynamics environment data', error);
          }
        )


      } else console.warn('Task does not exist anymore.');
    });

    flex.Actions.addListener("afterNavigateToView", (payload) => {
      panel(1);
    });

    flex.Actions.addListener("afterCompleteTask", (payload) => {
      panel(0);
    });
  }

  /**
   * Registers the plugin reducers
   *
   * @param manager { Flex.Manager }
   */
  registerReducers(manager) {
    if (!manager.store.addReducer) {
      // eslint: disable-next-line
      console.error(`You need FlexUI > 1.9.0 to use built-in redux; you are currently on ${VERSION}`);
      return;
    }

    manager.store.addReducer(namespace, reducers);
  }
}
