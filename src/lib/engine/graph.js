import * as _metric from './metric';
import * as _dgraph from './dgraph';
import _ from 'lodash';

//export interface Graph {
  //metrics?: Metric[],
  //guesstimates?: Guesstimate[],
  //simulations?: PartialSimulation[]
//}
//

export function create(graphAttributes){
  return _.pick(graphAttributes, ['metrics', 'guesstimates', 'simulations']);
}

export function denormalize(graph){
  let metrics = graph.metrics.map(m => _metric.denormalize(m, graph));
  return {metrics};
}

// The bizarro graph is the version of the graph where a guesstimates input is
// replaces its guesstimte
export function toBizarroGraph(graph, guesstimateForm){
  let bGraph = _.cloneDeep(graph)
  bGraph.guesstimates = graph.guesstimates.filter((g) => (g.metric !== guesstimateForm.metric))
  bGraph.guesstimates = bGraph.guesstimates.concat(guesstimateForm)
  return bGraph
}

export function runSimulation(graph, metricId, n){
  return _dgraph.runSimulation(denormalize(graph), metricId, n);
}

export function metric(graph, id){
  return graph.metrics.find(m => (m.id === id));
}
