# Add Lease Workflow

+ When on a property detail page.
+ If there is no lease, then there should be an add lease button.
+ If there is a lease then there should tenant information.
+ That tenant information will be derived from the Lease, LeaseLessee, LeaseOccupant entities.
+ Lets create two issues.  One issue will deal with the user workflow of if there is no lease.

## The task is two create to gh issues using the gh cli

### Proposed Issue 1: There is no lease

+ Have a create lease button
+ When button is clicked we go to the Create Lease Page
+ There is a form for creating the lease.
+ That form will have validation.
+ If the form is valid then the use can submit the lease for creation.
+ If success the form will redirect back the property detail page and the tenant/lease information will be present.
+ If failure then the user will see the error returned by the api.

### Proposed issue 2: There is a lease

+ We will display pertinent information regarding the lease.
+ This will be derived from the Lease, LeaseLessee and LeaseOccupant entities.

What is not is scope for these issues.
+ editing the lease
+ editing the occupants or lessees

