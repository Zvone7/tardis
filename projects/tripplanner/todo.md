-------------------------

whenever comparing locations, both on backend and frontend, make sure the comparison happens via latitude and logitude - and if its close enough (not sure what that really means) then its okay



additionally, when segment times are being edited by chatgpt, make sure that chat understands the timezone - if it doesnt, it should ask. i often provide screenshots from skyscanner - i am not sure if times when plane is landing in a different area is shown in that time zone or in takeoff time zone. gpt can use the user preferred location (its set in settings) as well as respect its set currency for the trip, but it should still try to udnerstand the necessary recalculation - time and currency

-------------------------
I'm thinking, I want to create a trip itiniearay page. I am not sure how it will look, but it will be acting in the same size as option editing when it comes to grid - so there will be a button when option is opened, inside its detail view, saying "itinierary" - it will have world globe icon.
the way it will look is something like:
a world map, showing all the locations where the option is going. it will be a rotatable globe, with dotted lines conecting locations between stages of trip. user can click on the icon (segment type) above the line to view information about it (such as the flight, or bus, or whatever transport segments are between locations).
then, on locations, there will be all icons for all different segments happening in that location, on which user can click again).
underneath the itinerary there is a detailed breakdown of the costs, per segment types, cost per day, start and end time etc etc



-------------------------

can segment modal be split up in smaller component?


-------------------------

-------------------------

--------------

backend: implement mapperly on backend

--------------

backend: implement languageExt on backend so that the results returned from endpoints always have more detailed exception - always display that in console in browser, but keep the notification to users simple


