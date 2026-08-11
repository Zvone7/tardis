update the icon for apartmentpicker to have a black background, but a green (3 pixels thic) border around it. inside it it will still say AP with correct env badge

-------------------------

what I want to build is an automatic update of infrastucture as code as part of my github actions.
there is a script called deploy.ps1 in pantry repository. that one, when running what if, will look at properties change and ignore some of them - that same script has to be added here - including the bicep files
Then, I will create another environment - infra-dev, in github, for tardis repository
what will happen is that the iac what-if will start running at the same time as the build of the code runs.
then it will take the results of the what-if, put them through the simplify output script, and if there are important differences, it will ask for manual approvement from a user. if there are none, that means it does not need to run - and deploy can proceed
if there are differences, and user approves, it will then run the infrastrcture. only after the deployment of iac is complete, the deploy will proceed
possible issues: there could be two iac deployments happening at the same time, since both FE and BE run at the same time - not sure how to fix this
for now, the changes are to be done for tripplanner only, but eventually it will be done for apartmentpicker too

-------------------------

-------------------------

-------------------------

-------------------------