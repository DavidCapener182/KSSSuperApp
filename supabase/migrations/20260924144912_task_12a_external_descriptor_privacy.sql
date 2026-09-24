-- TASK-12A: reinforce the neutral external-party descriptor boundary at the data layer.
alter table public.incident_external_parties
  add constraint incident_external_parties_neutral_descriptor_check check (
    descriptor !~* '(@|https?://|www\.|\+?[0-9][0-9 ()-]{6,})'
    and descriptor !~ '[A-Z][a-z]+[[:space:]]+[A-Z][a-z]+'
    and descriptor !~* '\m[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}\M'
    and descriptor !~* '\m[A-Z]{1,2}[0-9][A-Z0-9]?[[:space:]]*[0-9][A-Z]{2}\M'
    and descriptor !~* '\m[0-9]{1,5}[[:space:]]+([[:alpha:]]+[[:space:]]+)*(street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|crescent|court|way|terrace)\M'
  );
