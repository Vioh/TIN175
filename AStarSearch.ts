/********************************************************************************
This module contains A* search implementation, parameterised by a 'Node' type.
@param graph: The graph on which to perform A* search.
@param start: The initial node.
@param goal: Function that returns true if the algorithm has reached the goal.
@param heuristics: Function that estimates the heuristics cost of reaching the goal from a given Node.
@param timeout: Maximum time (in seconds) to spend performing A* search.
@returns: Returns a search result [path from start to goal, total cost, and some statistics].
********************************************************************************/

import {Successor, Graph, SearchResult} from "./Graph";
import Dictionary from "./lib/typescript-collections/src/lib/Dictionary";
import PriorityQueue from "./lib/typescript-collections/src/lib/PriorityQueue";

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
            // undefined values are used only for the first search node (i.e. the start).
            public parent    : SearchNode      | undefined, // parent search node
            public edge      : Successor<Node> | undefined, // edge.child is current graph node
            public totalcost : number,                      // total cost from start node
            public astarcost : number,                      // total cost plus heuristics cost
        ) {};
    }

    // Define function to compare 2 searchnodes (x < y if x has higher cost than y).
    function compare(x : SearchNode, y : SearchNode) : number {
        if(x.astarcost > y.astarcost) return -1;
        if(x.astarcost < y.astarcost) return 1;
        return 0;
    }

    // Define function to compute the path via backtracking.
    function path(endNode : SearchNode) : Successor<Node>[] {
        var path : Successor<Node>[] = [];
        var node : SearchNode = endNode;
        while(node.edge && node.parent) { // while node is not the start node
            path.push(node.edge);
            node = node.parent;
        }
        return path.reverse();
    }

    // Define function to compute the heuristics cost for a specified node.
    function heurcost(node : Node) : number {
        var cost : number | undefined = heurTable.getValue(node); // look up in heurTable
        if(!cost) // undefined means heur cost has not been computed before for this node
            heurTable.setValue(node, (cost = heuristics(node)));
        return cost;
    }

    // Start the timer and define some useful data structures.
    var endTime = Date.now() + timeout * 1000;
    var frontier   : PriorityQueue<SearchNode> = new PriorityQueue<SearchNode>(compare);
    var astarTable : Dictionary<Node,number> = new Dictionary(); // map node to minimum astarcost
    var heurTable  : Dictionary<Node,number> = new Dictionary(); // map node to heuristics cost
    frontier.add(new SearchNode(undefined, undefined, 0, heurcost(start)));    // add start node to the frontier
    astarTable.setValue(start, heurcost(start));

    // Searching begins here
    while(Date.now() < endTime) {
        var searchnode : SearchNode | undefined = frontier.dequeue();
        if(!searchnode) {
            // frontier is empty, so the search has failed
            return new SearchResult<Node>('failure', [], -1, astarTable.size());
        }
        var graphnode : Node = (searchnode.edge)? searchnode.edge.child : start;
        if(goal(graphnode)) {
            // found a path to goal, so returns success
            return new SearchResult<Node>('success', path(searchnode), searchnode.totalcost, astarTable.size());
        }
        var successors : Successor<Node>[] = graph.successors(graphnode);
        for (var next of successors) {
            var oldcost : number | undefined = astarTable.getValue(next.child);
            var totalcost : number = searchnode.totalcost + next.cost;
            var astarcost : number = totalcost + heurcost(next.child);
            if(!oldcost || astarcost < oldcost) {
                // add to frontier only if the new path gives a lower astarcost than previously found
                astarTable.setValue(next.child, astarcost);
                frontier.enqueue(new SearchNode(searchnode, next, totalcost, astarcost));
            }
        }
    }
    return new SearchResult<Node>('timeout', [], -1, astarTable.size());
}