-------------------------
move all models into models.ts

-------------------------

the segment name should actually be more serving as a comment - change it everywhere except in the database model. then when displaying it, display it as a less important field - make sure thats everywhere (timeline card, segment detail view etc)

-------------------------

can SegmentDetailContent be split into smaller files?

-------------------------

on itinerary edit, there is no more filter by segment type - not sure why it disappeared. also, sometimes when there is many flight on same thay, all the icons overlap and they are hard to be clicked - perhaps they can then be split into seeral rows?

-------------------------

when several segments are selected, user is able to edit their start location and their end location (but only together.)
I would like for this to become more of a batch edit of several things
- start location (and just start location)
- end location (and just end location)
- start time 
- segment type
also, when the segments are selected, make that menu be a bit more visuably obvious and easier to use with changes I am proposing

-------------------------

there is a weird glitch on mobile and on desktop = whem i open itinerary view, the map is at the top of the window that show. however, it doesnt expand full way down, even though it coudl.
when i collapse the map, the section with breakdown of costs is shown - however, when i collapse that too there is map underneath again - not sure if its duplicate or same map not properly hidden

-------------------------

backend: implement mapperly on backend

-------------------------

backend: implement languageExt on backend so that the results returned from endpoints always have more detailed exception - always display that in console in browser, but keep the notification to users simple


