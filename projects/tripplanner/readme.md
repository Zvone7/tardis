# Trip planner

Quick app for laying out different trips and trip options. Check it out [here](https://dev-wapp-tripplanner-fe-gzdghmetfqdyf6be.northeurope-01.azurewebsites.net/).

Let's say you are considering flying to Amsterdam, but the flights on Saturday are more expensive than on Friday.
However, then you need to book one night less - how much will that cost total?

Trip planner to rescue - add different options (Saturday/Friday) and different Segments to those options (fligths out and accomodation). Add prices. See clear differences. Or at least that's the idea.

It's also just fun to test the [v0.dev](https://v0.dev/chat/trip-component-design-g7k9f5NKylf) chatgpt thingy.

# How to get secrets for local development

## azure credentials
Locally, you may not be able to connect to keyvault with azure default credential. For that, an app registration has been created.

Find it in azure portal: [tripplanner-dev](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/6a15f181-b0e4-477f-af30-e4401cc8d9e6/isMSAApp~/false)

## google credentials
Find them in [google portal](https://console.cloud.google.com/auth/clients?highlightClient=34984745962-g9vkhpoi9schcfj5ot43jfcnmdnilaea.apps.googleusercontent.com&inv=1&invt=AbrgIw&project=tripplanner-444816).

## Finally, add it to appsettings.Development.json

```json
{
  "GoogleAuthSettings": {
        "ClientId": "",
        "ClientSecret": ""
    },
  "AzureAd": {
    "ClientId": "",
    "ClientSecret": "",
    "TenantId": ""
    }
}
```

# How to get google auth working
- added https://backendurl/signin-google to redirect urls in web client google