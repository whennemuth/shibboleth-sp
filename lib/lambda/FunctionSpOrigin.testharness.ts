import * as event from './lib/sp-event.json';
import { handler } from './FunctionSpOrigin';


handler(event).then((response) => {
  JSON.stringify(response, null, 2);
})