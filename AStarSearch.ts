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
import Set from "./lib/typescript-collections/src/lib/Set";

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

export function anytimeAStarSearch<Node>(
    graph: Graph<Node>,
    start: Node,
    goal: (n: Node) => boolean,
    heuristics: (n: Node) => number,
    timeout: number
): SearchResult<Node> {

    // Define a class to represent a search node
    class SearchNode {
        constructor(
            // undefined values are used only for the first search node (i.e. the start).
            public parent: SearchNode | undefined, // parent search node
            public edge: Successor<Node> | undefined, // edge.child is current graph node
            public totalcost: number,                      // total cost from start node
            public astarcost: number,                      // total cost plus heuristics cost
        ) { };
    }

    // Start the timer and define some useful data structures.

    var endTime = Date.now() + timeout * 1000;
    let eps: number = 10; //inflation factor intitalized to 10
    let frontier: PriorityQueue<SearchNode> = new PriorityQueue<SearchNode>(compare);
    let closed: Set<Node> = new Set<Node>(); //set to keep already explored nodes
    let incons: Set<SearchNode> = new Set<SearchNode>(); //set to keep inconsistent nodes
    var heurTable: Dictionary<Node, number> = new Dictionary(); // map node to heuristics cost
    var gcostTable: Dictionary<Node, number> = new Dictionary(); //map node to actual path cost
    var searchResult: SearchResult<Node> = new SearchResult<Node>('unknown', [], -1, gcostTable.size());
    let fGoal: number = 100000000; //initialize the f-value of goal to large number
    let finaleps: number;
    frontier.add(new SearchNode(undefined, undefined, 0, eps * getcost(heurTable, true, start)));    // add start node to the frontier
    gcostTable.setValue(start, 0);

    improvePath();
    while (eps > 1) {
        if (Date.now() > endTime) {
            if (searchResult.status == 'success') return searchResult;
            else return new SearchResult<Node>('timeout', [], -1, gcostTable.size());
        }
        eps = eps - 0.5;
        incons.forEach(function (searchnode) {
            frontier.enqueue(searchnode);
        });
        frontier.forEach(function (searchnode) {
            var graphnode: Node = (searchnode.edge) ? searchnode.edge.child : start;
            searchnode.astarcost = fvalue(graphnode);
        });
        incons.clear();
        refresh();
        closed.clear();
        improvePath();
    }
    if (searchResult.status == 'success') { console.log('Finale eps:' + eps); return searchResult; }
    else return new SearchResult<Node>('failure', [], -1, gcostTable.size());
    

    //Define function to find the improved path to goal node
    function improvePath() {
        var searchnode: SearchNode | undefined = frontier.peek();
        if (searchnode) {
            var graphnode: Node = (searchnode.edge) ? searchnode.edge.child : start;
            var gcost: number = getcost(gcostTable, false, graphnode);
            if (goal(graphnode)) {
                finaleps = eps;
                fGoal = fvalue(graphnode);
                searchResult = new SearchResult<Node>('success', path(searchnode), searchnode.totalcost, gcostTable.size());
            }
            while (fGoal > fvalue(graphnode)) {
                if (Date.now() > endTime) break;
                frontier.dequeue();
                closed.add(graphnode);
                let successors: Successor<Node>[] = graph.successors(graphnode);
                for (var next of successors) {
                    let gchildcost: number = getcost(gcostTable, false, next.child);
                    if (!gchildcost || (gchildcost > (gcost + next.cost))) {
                        gchildcost = gcost + next.cost;
                        gcostTable.setValue(next.child, gchildcost);
                        let newSearchNode: SearchNode = new SearchNode(searchnode, next, gchildcost, fvalue(next.child));
                        if (!closed.contains(next.child)) frontier.enqueue(newSearchNode);
                        else incons.add(newSearchNode);
                    }
                }

                searchnode = frontier.peek();
                if (!searchnode) break;
                graphnode = (searchnode.edge) ? searchnode.edge.child : start;
                gcost = getcost(gcostTable, false, graphnode);
                if (goal(graphnode)) {
                    finaleps = eps;
                    fGoal = fvalue(graphnode);
                    searchResult = new SearchResult<Node>('success', path(searchnode), searchnode.totalcost, gcostTable.size());
                }

            }
        }
    }

    function refresh() {
        var items: SearchNode[] = [];
        for (var _i = 0; _i < frontier.size(); _i++) {
            let item: SearchNode | undefined = frontier.dequeue();
            if (item) items.push(item);
        }
        items.forEach(function (searchnode) { frontier.enqueue(searchnode); });
    }

    // Define function to compare 2 searchnodes (x < y if x has higher cost than y).
    function fvalue(node: Node): number {
        return getcost(gcostTable, false, node) + eps * getcost(heurTable, true, node);
    }

    // Define function to compare 2 searchnodes (x < y if x has higher cost than y).
    function compare(x: SearchNode, y: SearchNode): number {
        if (x.astarcost > y.astarcost) return -1;
        if (x.astarcost < y.astarcost) return 1;
        return 0;
    }

    // Define function to compute the path via backtracking.
    function path(endNode: SearchNode): Successor<Node>[] {
        var path: Successor<Node>[] = [];
        var node: SearchNode = endNode;
        while (node.edge && node.parent) { // while node is not the start node
            path.push(node.edge);
            node = node.parent;
        }
        return path.reverse();
    }

    // Define function to compute the heuristics/actual cost for a specified node.
    function getcost(dictionary: Dictionary<Node, number>, isHeuristics: boolean, node: Node): number {
        var cost: number | undefined = dictionary.getValue(node); // look up in heurTable
        if (!cost && isHeuristics) // undefined means heur cost has not been computed before for this node
            dictionary.setValue(node, (cost = heuristics(node)));
        return <number>cost;
    }
}