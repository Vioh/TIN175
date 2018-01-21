
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
            public edge       : Successor<Node>,
            public parentNode : SearchNode,
            public totalcost  : number, // total cost from start node
            public astarcost  : number, // total cost plus heuristics cost
        ) {};
    }
    // Define a compare function
    var compare : (a: SearchNode, b: SearchNode) => number;
    compare = function(a: SearchNode, b: SearchNode) : number {
        if(a.astarcost < b.astarcost) return -1;
        if(a.astarcost > b.astarcost) return 1;
        return 0;
    }
    // Define function to compute the path
    function computePath(end : SearchNode) : Successor<Node>[] {
        var path : Successor<Node>[] = [];
        var currentNode  : SearchNode = end;
        while(currentNode.edge) {
            path.push(currentNode.edge);
            currentNode = currentNode.parentNode;
        }
        return path.reverse();
    }
    // Define neccessary variables
    var endTime = Date.now() + timeout * 1000;
    var visited : Set<Node> = new Set();
    var frontier : PriorityQueue<SearchNode> = new PriorityQueue<SearchNode>(compare);
    frontier.enqueue(new SearchNode(undefined, undefined, 0, undefined));
    visited.add(start);

    while(Date.now() < endTime) {
        var currentNode : SearchNode = frontier.dequeue();
        if(goal(currentNode.edge.child))
    }
    

    
    // // A dummy search implementation: it returns a random walk
    // var cost = 0;
    // var path : Successor<Node>[] = [];
    // currentNode = start;
    // var visited : Set<Node> = new Set();
    // visited.add(currentNode);

    // var endTime = Date.now() + timeout * 1000;
    // while (Date.now() < endTime) {
    //     if (goal(currentNode)) {
    //         // We found a path to the goal!
    //         return new SearchResult<Node>('success', path, cost, visited.size());
    //     }
    //     var successors : Successor<Node>[] = graph.successors(currentNode);
    //     var next : Successor<Node> | null = null;
    //     while (!next && successors.length > 0) {
    //         var n = Math.floor(Math.random() * successors.length);
    //         if (visited.contains(successors[n].child)) {
    //             successors.splice(n, 1);
    //         } else {
    //             next = successors[n];
    //         }
    //     }
    //     if (!next) {
    //         // We reached a dead end, but we return the path anyway
    //         return new SearchResult<Node>('success', path, cost, visited.size());
    //     }
    //     path.push(next);
    //     currentNode = next.child;
    //     visited.add(currentNode);
    //     cost += next.cost;
    // }
    // return new SearchResult<Node>('timeout', [], -1, visited.size());
}

