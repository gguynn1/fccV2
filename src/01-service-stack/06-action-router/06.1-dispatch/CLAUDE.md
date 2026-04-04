# Dispatch

Send now via the Transport Layer (back up to top)

## Immediate Priority

Time-sensitive, send now. Pickup in 30 minutes, bill due today, calendar conflict detected, response to a direct question.

The Action Router's `dispatch` outcome is still subject to the Worker's final topic-delivery guard before transport. Dispatch means "ready to send now if the chosen thread is allowed," not "cannot be rerouted or blocked."
