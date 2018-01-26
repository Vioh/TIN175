
import {Successor, Graph, SearchResult} from "./Graph";

// You might want to use one of these:
import Set from "./lib/typescript-collections/src/lib/Set";
import Dictionary from "./lib/typescript-collections/src/lib/Dictionary";
import PriorityQueue from "./lib/typescript-collections/src/lib/PriorityQueue";

/********************************************************************************
** AStarSearch

This module contains an implementation of the A* algorithm.
You should change the function 'aStarSearch'. 
********************************************************************************/

/* A* search implementation, parameterised by a 'Node' type. 
 * The code here is just a template; you should rewrite this function entirely.
 * This template produces a dummy search result which is a random walk.
 *
 * Note that you should not change the API (type) of this function, only its body.
 *
 * @param graph: The graph on which to perform A* search.
 * @param start: The initial node.
 * @param goal: A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
 * @param heuristics: The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
 * @param timeout: Maximum time (in seconds) to spend performing A* search.
 * @returns: A search result, which contains the path from 'start' to a node satisfying 'goal', 
 *           the cost of this path, and some statistics.
 */

export function aStarSearch<Node> (
    graph : Graph<Node>,
    start : Node,
    goal : (n:Node) => boolean,
    heuristics : (n:Node) => number,
    timeout : number
) : SearchResult<Node> {

    // Define a class to represent a search node
    class SearchNode {
        public parentNode: SearchNode | undefined;
        public graphNode: Successor<Node> | undefined;
        public totalCost: number;
        public astarcost: number;
        constructor(parent: SearchNode, node: Successor<Node>, cost: number) {
            this.parentNode = parent;
            this.graphNode = node;
            this.totalCost = cost;
            this.astarcost = (this.graphNode) ? this.totalCost + heuristics(this.graphNode.child) : heuristics(start);
        }
    }
    // Define a compare function
    var compare : (a: SearchNode, b: SearchNode) => number;
    compare = function(a: SearchNode, b: SearchNode) : number {
        if(a.astarcost > b.astarcost) return -1;
        if(a.astarcost < b.astarcost) return 1;
        return 0;
    }
    // Define function to compute the path

    function path(endNode : Node) : Successor<Node>[] {
        var path : Successor<Node>[] = [];
        var node : Node = endNode;
        var curSearchNode: SearchNode | undefined = nodeDictionary.getValue(node);
        while(curSearchNode) {
            path.push(curSearchNode.graphNode);
            curSearchNode = (curSearchNode.parentNode.graphNode) ? nodeDictionary.getValue(curSearchNode.parentNode.graphNode.child) : undefined;
        }
        return path.reverse();
    }
    // Start the timer, define the frontier and the visited set
    var currentSearchNode: SearchNode | undefined;
    var currentNode: Node;
    var nodeDictionary: Dictionary<Node, SearchNode|undefined> = new Dictionary<Node,SearchNode|undefined>();
    var endTime = Date.now() + timeout * 1000;
    var frontier : PriorityQueue<SearchNode> = new PriorityQueue<SearchNode>(compare);
    var successors: Successor<Node>[] = [];

    frontier.enqueue(new SearchNode(undefined, undefined,0));
    
    // Searching begins here
    while(Date.now() < endTime) {
        currentSearchNode = frontier.dequeue();

        if(!currentSearchNode) {
            return new SearchResult<Node>('failure', [], -1, nodeDictionary.keys.length + frontier.size());
        }

        if(currentSearchNode.graphNode){
            currentNode = currentSearchNode.graphNode.child;
            if(!nodeDictionary.containsKey(currentNode)){
                nodeDictionary.setValue(currentNode, currentSearchNode);
            }
            else{
                var val:SearchNode = nodeDictionary.getValue(currentNode);
                if(val.astarcost > currentSearchNode.astarcost){
                    nodeDictionary.setValue(currentNode, currentSearchNode);
                }
            }
        }
        else{
            currentNode = start;
            nodeDictionary.setValue(start, undefined);
        }

        if(goal(currentNode)) {
            return new SearchResult<Node>('success', path(currentNode), currentSearchNode.totalCost, nodeDictionary.keys.length + frontier.size());
        }
        successors = graph.successors(currentNode);
        if(successors.length>0){
            for (var next of successors){
                frontier.enqueue(new SearchNode(currentSearchNode,next,currentSearchNode.totalCost+next.cost));
            }
        }
    }
    return new SearchResult<Node>('timeout', [], -1, nodeDictionary.keys().length+frontier.size());
}