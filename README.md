# Twilio Flex plugin for MS Dynamics 365 Customer Service Hub

This monorepo contains everything that's necessary to deploy a sample integration between Twilio and MS Dynamics 365 Customer Service Hub, using Twilio Serverless &amp; Twilio Studio, as seen in **Twilio's Integration Breakfast webinar**: https://ahoy.twilio.com/emea-integration-breakfast-ms-dynamics-1-ty

The code is for learning purposes only, to give you an idea on how to get such integration up and running, and is **not supported by Twilio**.

## What you will need

- Twilio Flex Project, https://support.twilio.com/hc/en-us/articles/360020442333-Setup-a-Twilio-Flex-Project
- MS Dynamics 365 org, free trial is fine
- MS Azure, for Active Directory authentication & API access to Dynamics
- Local Node.js development environment to deploy Twilio Functions & Twilio Flex plugins (i.e. contents of this repo)

## What this repo contains

### Twilio Serverless Functions

The [functions](functions) directory contains a Twilio Serverless project, created using [Twilio's Serverless Toolkit](https://www.twilio.com/docs/labs/serverless-toolkit). It contains 2 Functions to authenticate with MS Dynamics and retrieve Contact & Incident data. The function code is largely based on the existing example: https://www.twilio.com/blog/integrate-flex-microsoft-dynamics-365, with a few changes noted below:
- [functions/functions/get-dynamics-token.js](functions/functions/get-dynamics-token.js) - retrieves the token to authenticate subsequent API requests to Dynamics using Client credentials, rather than a username and password.
- [plugin-dynamics-flex](plugin-dynamics-flex) - No major changes from the example code.

### Twilio Flex Plugin

The [plugin-dynamics-flex](plugin-dynamics-flex) directory contains a [Twilio Flex Plugins CLI project](https://www.twilio.com/docs/flex/quickstart/getting-started-plugin). The main file of interest here is [plugin-dynamics-flex/src/DynamicsFlexPlugin.js](plugin-dynamics-flex/src/DynamicsFlexPlugin.js), as it contains all logic related to controlling MS Dynamics Behaviour (e.g. screen popping, event logging), via the [Microsoft CIF Framework JavaScript API](https://docs.microsoft.com/en-us/dynamics365/customer-service/channel-integration-framework/reference/microsoft-ciframework)

### Twilio Studio Flow

[studio/voice-ivr-flow.json](studio/voice-ivr-flow.json) contains a [Twilio Studio](https://www.twilio.com/docs/studio) flow definition for an IVR that accepts an incoming call, uses the functions to retrieve relevant Dynamics data, greets the caller and creates a task in Twilio Flex.

## How to set everything up

This guide focuses on setting up the Twilio environment, for more information about configuring Dynamics, refer to the previously mentioned [blog post](https://www.twilio.com/blog/integrate-flex-microsoft-dynamics-365)

### Configure and deploy your functions

Inside the [functions](functions) directory, create a compy of the [functions/.env.example](functions/.env.example) file called `.env`, which will contain environment variables for your functions.
```
cd functions
cp .env.example .env
```
- `MS_ORG_NAME` - name of your dynamics organization (e.g. flyowl)
- `MS_APP_CLIENT_ID` - ID of the Azure app used for API access
- `MS_DIRECTORY_TENANT_ID` - Azure tenant ID
- `MS_CLIENT_SECRET` - Azure app client secret

You can then deploy your functions.
```
twilio serverless:deploy
```
Once deployed, the functions can be viewed in the Twilio Console (https://www.twilio.com/console/functions/overview/services), but will not be editable. You can read more about deploying functions with the Serverless Toolkit [here](https://www.twilio.com/docs/labs/serverless-toolkit/deploying#deploying-new-code)

### Import your Studio flow

You can follow [this guide](https://www.twilio.com/docs/studio/user-guide#importing-and-exporting-flows) to import the Studio flow contained in [studio/voice-ivr-flow.json](studio/voice-ivr-flow.json). It will look something like this:

![flow](https://images-5353.twil.io/Voice_IVR_-_Twilio_Studio.png)

### Deploy your Flex plugin

Change the following value in [plugin-dynamics-flex/src/DynamicsFlexPlugin.js](plugin-dynamics-flex/src/DynamicsFlexPlugin.js#L9) (line 9) to correspond to your Dynamics org URI:

```js
const DYNAMICS_ORG = 'yourorgname.crm4.dynamics.com';
```

Navigate to the Flex plugin directory and deploy the plugin

```
# From project root
cd plugin-dynamics-flex
twilio flex:plugins:deploy --changelog "Dynamics Integration"
```

You can then validate the plugin was deployed successfully by opening the Flex admin console: https://flex.twilio.com/admin/plugins

Read more Flex plugin development here: https://www.twilio.com/docs/flex/quickstart/getting-started-plugin

## FAQ

### Getting 401 errors when accessing the Dynamics API

You may need to enable implicit token authentication flows in your Azure app's manifest:

![manifest](https://images-5353.twil.io/manifest.png)

Ensure your application is configured as an Application User in MS Dynamics, and that it hass access to the roles you specified when configuring the CIF integration.

![application user](https://images-5353.twil.io/application_user.png)
