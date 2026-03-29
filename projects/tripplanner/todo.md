

can segmentlist and optionlist a be single component? does it make sense?
what about segmentdetailcontent and optionedetailcotent? same for panels?
or is there too many differences/not repeating components/behaviors?

-------------------------

when recommending locations to user, existing locations used in other segments should be at the top - if there is any string matching overlap. wll improve caching and using same locations
only allow one location per city - refine that search. do they need to be hardcoded?
i also have this issue, idk if its specific for norway, but sometimes location is oslo, norway, sometimes oslo, norway, norway - is there an easy way to fix that? if not, perhaps we can come up with sql table to blacklist location that can be managed through admin page. i will need sql and full backed for it so i hope we can avoid it

-------------------------

in patry repository, i added optimization for building images - so that content hash is calculated. make those improvements for backend and frontend inside each project but also for each project (TP, AP)

-------------------------

can segment modal be split up in smaller component?


-------------------------

-------------------------

--------------

backend: implement mapperly on backend

--------------

backend: implement languageExt on backend so that the results returned from endpoints always have more detailed exception - always display that in console in browser, but keep the notification to users simple


---------- 20x

- Investigate possible booking.com integration


- Investigate possible google flights/skyscanner integration

