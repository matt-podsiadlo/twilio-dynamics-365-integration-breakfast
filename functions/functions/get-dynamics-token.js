exports.handler = function (context, event, callback) {
    var DynamicsWebApi = require('dynamics-web-api');
    var clientId = process.env.MS_APP_CLIENT_ID;
    var AuthenticationContext = require('adal-node').AuthenticationContext;
    //OAuth Token Endpoint
    var authorityUrl = 'https://login.microsoftonline.com/' + process.env.MS_DIRECTORY_TENANT_ID + '/oauth2/token';
    //CRM Organization URL
    var resource = 'https://' + process.env.MS_ORG_NAME + '.crm4.dynamics.com';
    var clientSecret = process.env.MS_CLIENT_SECRET;
    var adalContext = new AuthenticationContext(authorityUrl);
    var tokenTemp = '';
    //add a callback as a parameter for your function
    function acquireToken(dynamicsWebApiCallback) {
        //a callback for adal-node
        function adalCallback(error, token) {
            if (!error) {
                //call DynamicsWebApi callback only when a token has been retrieved
                console.log('Token has been received', token)
                tokenTemp = token.accessToken;
                dynamicsWebApiCallback(token);
                callback(null, tokenTemp);
            }
            else {
                console.log('Token has not been retrieved. Error: ' + error.stack);
                callback(error, null);
            }
        }
        //call a necessary function in adal-node object to get a token
        // adalContext.acquireTokenWithUsernamePassword(resource, username, password, clientId, adalCallback); - Outdated, use client secret instead
        adalContext.acquireTokenWithClientCredentials(resource, clientId, clientSecret, adalCallback);
    }
    var dynamicsWebApi = new DynamicsWebApi({
        webApiUrl: 'https://' + process.env.MS_ORG_NAME + '.api.crm4.dynamics.com/api/data/v9.0/',
        onTokenRefresh: acquireToken
    });
    //call any function
    dynamicsWebApi.executeUnboundFunction("WhoAmI").then(function (response) {
        callback(null, tokenTemp);
    }).catch(function (error) {
        callback(error, null);
    });
};