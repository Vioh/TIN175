
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
            // undefined values are used only for the first search node (i.e. the start).
            public parentNode    : SearchNode      | undefined, // parent search node
            public graphNode      : Successor<Node> | undefined, // edge.child is current graph node
            public totalCost : number,                      // total cost from start node
            public heuristicCost : number,                      // total cost plus heuristics cost
) {};
    }

    // * Define a compare function for PriorityQueue *
    var compare : (a: SearchNode, b: SearchNode) => number;
    compare = function(a: SearchNode, b: SearchNode) : number {
        if((a.totalCost + a.heuristicCost) > (b.totalCost + b.heuristicCost)) return -1;
        if((a.totalCost + a.heuristicCost) < (b.totalCost + b.heuristicCost)) return 1;
        return 0;
    }

    // * Define function to compute the path via backtracking *
    function path(endNode : Node) : Successor<Node>[] {
        var path : Successor<Node>[] = [];
        var curSearchNode: SearchNode | undefined = nodeDictionary.getValue(endNode); // * Dictionary keeps the minimum cost path to a node from start node *
        while(curSearchNode) {
            path.push(curSearchNode.graphNode);
            curSearchNode = (curSearchNode.parentNode.graphNode) ? nodeDictionary.getValue(curSearchNode.parentNode.graphNode.child) : undefined;
        }
        return path.reverse();
    }

    // Variable declaration
    var currentSearchNode: SearchNode | undefined;	// * to keep the SearchNode dequeued from the PriorityQueue
    var currentNode: Node = start;						// * to keep the GraphNode to currentSearchNode
    var nodeDictionary: Dictionary<Node, SearchNode> = new Dictionary<Node,SearchNode>();	// * to keep track of visisted nodes
    var endTime = Date.now() + timeout * 1000;
    var frontier : PriorityQueue<SearchNode> = new PriorityQueue<SearchNode>(compare); 
    var successors: Successor<Node>[] = [];
    var visited : Set<Node> = new Set();
    
    currentSearchNode = new SearchNode(undefined, undefined,0, heuristics(start));
    frontier.enqueue(currentSearchNode); // * specific to start node *
    nodeDictionary.setValue(currentNode, currentSearchNode);
    
    // Searching begins here
    while(Date.now() < endTime) {
        currentSearchNode = frontier.dequeue();

        if(!currentSearchNode) {
            return new SearchResult<Node>('failure', [], -1, visited.size() + frontier.size());
        }
        currentNode = (currentSearchNode.graphNode) ? currentSearchNode.graphNode.child : start;
        visited.add(currentNode);

        if(goal(currentNode)) {
            return new SearchResult<Node>('success', path(currentNode), currentSearchNode.totalCost, visited.size() + frontier.size());
        }

        successors = graph.successors(currentNode);
        var heuristicCost: number;
        
        if(successors.length>0){
        	for (var next of successors){
        		if(visited.contains(next.child)){
        			continue;
        		}

            	if(!nodeDictionary.containsKey(next.child)){
            		var newNextNode: SearchNode = new SearchNode(currentSearchNode,next,currentSearchNode.totalCost+next.cost, heuristics(next.child));
            		frontier.enqueue(newNextNode);
            		nodeDictionary.setValue(next.child, newNextNode);
            	}
            	else{
            		var previousNode: SearchNode = nodeDictionary.getValue(next.child);
            		if((currentSearchNode.totalCost + next.cost) < previousNode.totalCost){
            			var newNextNode: SearchNode = new SearchNode(currentSearchNode,next,currentSearchNode.totalCost+next.cost, previousNode.heuristicCost);
            			nodeDictionary.setValue(next.child, newNextNode);
            		}
            	}
        	}
        }
    }
    return new SearchResult<Node>('timeout', [], -1, visited.size() + frontier.size());
}