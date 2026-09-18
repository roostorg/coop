import env from '#start/env';

export default {
  /**
   * The fraction of item submissions routed through the async processing queue
   * (BullMQ) rather than handled inline after returning 202. `1` sends all
   * traffic through the queue, `0` none of it.
   */
  itemQueueTrafficPercentage: env.get('ITEM_QUEUE_TRAFFIC_PERCENTAGE'),
};
