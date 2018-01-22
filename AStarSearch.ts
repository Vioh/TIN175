
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
        constructor(
            public parentNode : SearchNode | undefined, // undefined if parent is start node
            public nextEdge   : Successor<Node>,        // edge incident to the parent
            public totalcost  : number,                 // total cost from start node
            public astarcost  : number,                 // total cost plus heuristics cost
        ) {};
    }
    // Define a compare function
    var compare : (a: SearchNode, b: SearchNode) => number;
    compare = function(a: SearchNode, b: SearchNode) : number {
        if(a.astarcost > b.astarcost) return -1;
        if(a.astarcost < b.astarcost) return 1;
        return 0;
    }
    // Define function to compute the path
    function path(endNode : SearchNode) : Successor<Node>[] {
        var p : Successor<Node>[] = [];
        var curNode : SearchNode = endNode;
        while(curNode.parentNode) {
            p.push(curNode.nextEdge);
            curNode = curNode.parentNode;
        }
        return p.reverse();
    }
    // Start the timer, define the frontier and the visited set
    var endTime = Date.now() + timeout * 1000;
    var visited : Set<Node> = new Set();
    var frontier : PriorityQueue<SearchNode> = new PriorityQueue<SearchNode>(compare);
    
    // Initialize the search with the start node
    visited.add(start);
    if(goal(start))
        return new SearchResult<Node>('success', [], 0, visited.size());
    var successors : Successor<Node>[] = graph.successors(start);
    for(var edge of successors) {
        if(Date.now() >= endTime) break;
        visited.add(edge.child);
        var astarcost : number = edge.cost + heuristics(edge.child);
        frontier.enqueue(new SearchNode(undefined, edge, edge.cost, astarcost));
    }
    // Searching begins here
    while(Date.now() < endTime) {
        var searchNode : SearchNode | undefined = frontier.dequeue();
        if(!searchNode) {
            return new SearchResult<Node>('failure', [], -1, visited.size());
        }
        var graphNode : Node = searchNode.nextEdge.child;
        if(goal(graphNode)) {
            return new SearchResult<Node>('success', path(searchNode), searchNode.totalcost, visited.size());
        }
        var successors : Successor<Node>[] = graph.successors(graphNode);
        for(var edge of successors) {
            visited.add(edge.child);
            var totalcost : number = searchNode.totalcost + edge.cost;
            var astarcost : number = totalcost + heuristics(edge.child);
            frontier.enqueue(new SearchNode(searchNode, edge, totalcost, astarcost));
        }
    }
    return new SearchResult<Node>('timeout', [], -1, visited.size());
}