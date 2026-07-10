import { EventEmitter } from 'events';

class OrderEventEmitter extends EventEmitter {}

declare global {
  var orderEventsGlobal: undefined | OrderEventEmitter;
}

const orderEvents = globalThis.orderEventsGlobal ?? new OrderEventEmitter();

export default orderEvents;

if (process.env.NODE_ENV !== 'production') {
  globalThis.orderEventsGlobal = orderEvents;
}
