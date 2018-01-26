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
import Set from "./lib/typescript-collections/src/lib/Set";
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
            public edge      : Successor<Node> | undefined, // edge.child is the graph node
            public totalcost : number,                      // total cost from start node
            public astarcost : number,                      // total cost plus heuristics cost
        ) {};
    }
    // Function to compare 2 searchnodes (a < b if a has higher cost than b).
    function compare(a : SearchNode, b : SearchNode) : number {
        if(a.astarcost > b.astarcost) return -1;
        if(a.astarcost < b.astarcost) return 1;
        return 0;
    }
    // Function to compute the path (acts as the backtracking step).
    function path(endNode : SearchNode) : Successor<Node>[] {
        var path : Successor<Node>[] = [];
        var node : SearchNode = endNode;
        while(node.edge && node.parent) {
            path.push(node.edge);
            node = node.parent;
        }
        return path.reverse();
    }
    // Function to compute the heuristics cost for a specified node.
    function heurcost(node : Node) : number {
        var cost : number | undefined = hCostDict.getValue(node);
        if(!cost) // if heuristic cost hasn't never been computed before
            hCostDict.setValue(node, (cost = heuristics(node)));
        return cost;
    }
    // Define some useful datastructures.
    var visited   : Set<Node> = new Set();                               // set of visited nodes
    var tCostDict : Dictionary<Node,number> = new Dictionary();             // total costs
    var hCostDict : Dictionary<Node,number> = new Dictionary();             // heuristic costs
    var frontier  : PriorityQueue<SearchNode> = new PriorityQueue(compare); // frontier

    // Start the timer and initialize with the start node.
    var endTime = Date.now() + timeout * 1000;
    frontier.add(new SearchNode(undefined, undefined, 0, 0));
    visited.add(start);

    // Searching begins here.    
    while(Date.now() < endTime) {
        var searchNode : SearchNode | undefined = frontier.dequeue();
        if(!searchNode) {
            return new SearchResult<Node>('failure', [], -1, visited.size());
        }
        var graphNode : Node = (searchNode.edge)? searchNode.edge.child : start;   //if the search node has an edge, then the graph node is equal to the child of that edge, otherwise the graph node is the start node. Test 
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
  

