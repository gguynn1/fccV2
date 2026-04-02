# Budget Service

Tracks outbound volume

Called by the Worker before dispatch

Knows:
messages sent per person today
messages sent per thread this hour
pending batched items
batch window timing

Returns:
send now
or batch with these other items
or hold until next digest
