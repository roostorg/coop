-- Change routing_rules and appeals_routing_rules destination_queue_id FK from
-- CASCADE to RESTRICT so that deleting a queue that is still referenced by a
-- routing rule is rejected at the DB level (rather than silently cascade-
-- deleting the rule and breaking routing for the org).

ALTER TABLE manual_review_tool.routing_rules
  DROP CONSTRAINT routing_rules_destination_queue_id_fkey,
  ADD CONSTRAINT routing_rules_destination_queue_id_fkey
    FOREIGN KEY (destination_queue_id)
    REFERENCES manual_review_tool.manual_review_queues(id)
    ON DELETE RESTRICT;

ALTER TABLE manual_review_tool.appeals_routing_rules
  DROP CONSTRAINT appeals_routing_rules_destination_queue_id_fkey,
  ADD CONSTRAINT appeals_routing_rules_destination_queue_id_fkey
    FOREIGN KEY (destination_queue_id)
    REFERENCES manual_review_tool.manual_review_queues(id)
    ON DELETE RESTRICT;
