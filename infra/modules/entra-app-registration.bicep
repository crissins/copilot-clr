// ============================================================================
// Entra ID App Registration (via Deployment Script)
// Creates/updates an App Registration for user authentication.
// Uses Azure CLI in a deployment script since ARM cannot manage Graph resources.
//
// signInAudience: AzureADandPersonalMicrosoftAccount
//   → Accepts org accounts AND personal @outlook.com / @hotmail.com
//
// Configures:
//   - SPA redirect URIs (localhost + SWA hostname)
//   - openid, profile, email as required scopes
// ============================================================================

@description('Azure region for the deployment script resource')
param location string

@description('Display name for the app registration')
param appDisplayName string = 'Copilot CLR'

@description('Static Web App hostname (e.g., xxx.azurestaticapps.net)')
param swaHostname string = ''

@description('Tags to apply')
param tags object = {}

// Build redirect URIs: always include localhost; add SWA if available
var swaRedirectUri = empty(swaHostname) ? '' : 'https://${swaHostname}'
var redirectUrisJson = empty(swaRedirectUri)
  ? '["http://localhost:5173"]'
  : '["http://localhost:5173","${swaRedirectUri}"]'

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-entra-app-script'
  location: location
  tags: tags
}

resource deploymentScript 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'create-entra-app-registration'
  location: location
  tags: tags
  kind: 'AzureCLI'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    azCliVersion: '2.63.0'
    retentionInterval: 'PT1H'
    timeout: 'PT10M'
    cleanupPreference: 'OnSuccess'
    scriptContent: '''
      #!/bin/bash
      set -euo pipefail

      APP_NAME="${1}"
      REDIRECT_URIS="${2}"

      # Check if app already exists
      EXISTING_APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)

      if [ -n "$EXISTING_APP_ID" ] && [ "$EXISTING_APP_ID" != "None" ]; then
        echo "App registration '$APP_NAME' already exists (appId=$EXISTING_APP_ID). Updating..."
        APP_ID="$EXISTING_APP_ID"

        # Update signInAudience, redirect URIs, and expose API
        az ad app update --id "$APP_ID" \
          --sign-in-audience AzureADandPersonalMicrosoftAccount \
          --web-redirect-uris [] \
          --identifier-uris "api://$APP_ID" \
          2>/dev/null || true

        az rest --method PATCH \
          --url "https://graph.microsoft.com/v1.0/applications(appId='$APP_ID')" \
          --headers "Content-Type=application/json" \
          --body "{
            \"spa\":{\"redirectUris\":$REDIRECT_URIS},
            \"api\":{
              \"oauth2PermissionScopes\":[{
                \"adminConsentDescription\":\"Allow the application to access the API on behalf of the signed-in user.\",
                \"adminConsentDisplayName\":\"Access as user\",
                \"id\":\"71391690-0701-447a-8b89-a29278918451\",
                \"isEnabled\":true,
                \"type\":\"User\",
                \"userConsentDescription\":\"Allow the application to access the API on your behalf.\",
                \"userConsentDisplayName\":\"Access as user\",
                \"value\":\"access_as_user\"
              }]
            }
          }"
      else
        echo "Creating new app registration '$APP_NAME'..."

        # Create with SPA redirect URIs, identifier URI, and exposed API scope
        RESULT=$(az rest --method POST \
          --url "https://graph.microsoft.com/v1.0/applications" \
          --headers "Content-Type=application/json" \
          --body "{
            \"displayName\":\"$APP_NAME\",
            \"signInAudience\":\"AzureADandPersonalMicrosoftAccount\",
            \"spa\":{\"redirectUris\":$REDIRECT_URIS},
            \"identifierUris\":[\"api://PLACEHOLDER_FOR_APP_ID\"],
            \"api\":{
              \"oauth2PermissionScopes\":[{
                \"adminConsentDescription\":\"Allow the application to access the API on behalf of the signed-in user.\",
                \"adminConsentDisplayName\":\"Access as user\",
                \"id\":\"71391690-0701-447a-8b89-a29278918451\",
                \"isEnabled\":true,
                \"type\":\"User\",
                \"userConsentDescription\":\"Allow the application to access the API on your behalf.\",
                \"userConsentDisplayName\":\"Access as user\",
                \"value\":\"access_as_user\"
              }]
            },
            \"requiredResourceAccess\":[{
              \"resourceAppId\":\"00000003-0000-0000-c000-000000000000\",
              \"resourceAccess\":[
                {\"id\":\"37f7f235-527c-4136-accd-4a02d197296e\",\"type\":\"Scope\"},
                {\"id\":\"14dad69e-099b-42c9-810b-d002981feec1\",\"type\":\"Scope\"},
                {\"id\":\"64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0\",\"type\":\"Scope\"}
              ]
            }]
          }")

        # Post-create fixup: Replace placeholder with actual app ID if needed (Graph doesn't allow self-ref during POST)
        # Actually, let's just use the appId from the result for identifierUris in a PATCH after.
        APP_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
        echo "Created app registration with appId=$APP_ID. Setting identifierUri..."
        
        az rest --method PATCH \
          --url "https://graph.microsoft.com/v1.0/applications(appId='$APP_ID')" \
          --headers "Content-Type=application/json" \
          --body "{\"identifierUris\":[\"api://$APP_ID\"]}"
      fi

      # Output the client ID for downstream use
      echo "{\"clientId\":\"$APP_ID\"}" > $AZ_SCRIPTS_OUTPUT_PATH
    '''
    arguments: '\'${appDisplayName}\' \'${redirectUrisJson}\''
  }
}

@description('The Application (client) ID of the registered app')
output clientId string = deploymentScript.properties.outputs.clientId
