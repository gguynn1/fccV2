# Routing Service

Applies the two routing rules

Called by the Worker

Inputs: topic, entities involved, is this a response or proactive?

Rule 1: response — same thread
Rule 2: proactive — narrowest thread

Returns: target thread ID
