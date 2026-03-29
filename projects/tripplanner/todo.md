-------------------------

alright, time to overhauls option connecting to segments. Instead of planning out the entire trips by selecting segments, trip should get split into stages - let's go splitting them by location.
so for example, a trip I'm looking at is leaving oslo, flying to budapes, then in budapes i rent a car and drive it around, and then eventually take a flight back from budapest to oslo.
so when user is planning, they will get asked to choose their starting location. options for that dropdown  will be based off of all of the segment locations. so there, they will choose oslo. then they can choose between all avilable segments for that trip id that have a start location in oslo.
once they choose it, selection location immediately becomes the destination of that flight from oslo, in this case budapest. however, it will be marked as stage 2, in the ui (maybe a new tab, inside the detailcontent) and there they can either go back to stage 1, to add the rental cars which are added with start or start/end location budapest) or they will stay in stage 2 and look at segments that have a start location now being budapest.
if there are flights that are not timewise reachable (lets say for stage 1 they selected flight that arrives to budapest on 5. april 12:55, flights that takeoff before 5.april 12:55 shouldnt even be shown - same for all segments, not just flights).
does this make sense?

-------------------------

-------------------------

can segment modal be split up in smaller component?


-------------------------

-------------------------

--------------

backend: implement mapperly on backend

--------------

backend: implement languageExt on backend so that the results returned from endpoints always have more detailed exception - always display that in console in browser, but keep the notification to users simple


