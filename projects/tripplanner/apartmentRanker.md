# App to use for ranking apartments

# models:

### RankingCasea
> Buying Apartment, Buying summer house, Renting apartment

Properties:
- id (guid)
- name (varchar 100)
- description (varchar 200)


### RankingIntervalType 
> i.e. size, price, distance to work etc...
> this one will also be used for hasWashingMachine, hasParking etc

Properties:
- id (guid)
- rankingCaseId (foreign key on RankingCase, guid)
- name (varchar 100)
- description (varchar 200)
- includeInRanking (bit)

### RankingInterval 
> i.e. 0-35, 35-45, 45-50

Properties:
- id (guid)
- rankingIntervalType (foreign key on RankingIntervalType, guid)
- startRange (int)
- endRange (int)
- point (decimal) amount of points awarded if actual value is inside this interval

### Apartment

Properties
- id (guid)
- rankingCaseId (foreign key to RankingCase, guid)
- name (varchar 64)
- silly name (varchar 64)
- link (varchar 512)
- comment (varchar 512)
- hide from rankings (bit)


### ApartmentDataPoint
> i.e. Size 35, Rent 200$, Utilities 50$

Properties:
- id (int)
- apartmentId (foreign key to Apartment, guid)
- rankingIntervalId (foreign key to RankingInterval, guid)
- decimalValue (decimal, expected value to 100 million, 2 decimal places)

# frontend:


view1  - list apartments
list of apartments with their point scoring value
will have ranking order, name, silly name, comment, link, points, arrow to view details
prompt:

view2 - apartment detail
each apartment with ability to view all of its data points, how much are they scoring based on that value, and their total score (both actual like 35/57 and percentage)

view3 - list ranking setups
all the intervals which are currently set

view4 - ranking setup details
ability to setup the interval. on top user chooses if its a simple (1 or 0) ranking or if its complex (has several)

view4a) - simple ranking setup
name, description, amount of points awarded if “checked” or doesnt have
 
view4b) - complex ranking setup
for each interval, with ability to add above and below, start range, end range and points awarded
 prefilled with 
- [-inf, 0]
- [0, inf] 
cant exit view without setting up points

# to figure out

how do i handle text intervals? (like lets say for storage room options are big and small - intervals are tricky there)