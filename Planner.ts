
/********************************************************************************
The goal of the Planner module is to take the interpetation(s) produced by the 
Interpreter module and to plan a sequence of actions for the robot to put the world 
into a state compatible with the user's command, i.e. to achieve what the user wanted.
********************************************************************************/
import {WorldState} from "./World";
import {Successor, Graph, SearchResult} from "./Graph";
import {aStarSearch} from "./AStarSearch";
import {ShrdliteResult, DNFFormula, Conjunction, Literal, SimpleObject} from "./Types";

/** 
 * Top-level driver for the Planner. 
 * It calls `makePlan` for each given interpretation generated by the Interpreter.
 * @param interpretations: List of possible interpretations.
 * @param world: The current state of the world.
 * @returns: List of planner results, which are the interpretation results augmented with plans. 
 *           Each plan is represented by a list of strings.
 *           If there's a planning error, it throws an error with a string description.
 */
export function plan(interpretations : ShrdliteResult[], world : WorldState) : ShrdliteResult[] {
    var errors : string[] = [];
    var plans : ShrdliteResult[] = [];
    for (var result of interpretations) {
        try {
            var theplan : string[] = makePlan(result.interpretation, world);
        } catch(err) {
            errors.push(err);
            continue;
        }
        result.plan = theplan;
        if (result.plan.length == 0) {
            result.plan.push("The interpretation is already true!");
        }
        plans.push(result);
    }
    if (plans.length == 0) {
        // merge all errors into one
        throw errors.join(" ; ");
    }
    return plans;
}
/** 
 * The core planner method.
 * @param interpretation: The logical interpretation of the user's desired goal. 
 * @returns: A plan, represented by a list of strings.
 *           If there's a planning error, it throws an error with a string description.
 */
function makePlan(intp : DNFFormula, world : WorldState) : string[] {
    let start : ShrdliteNode = new ShrdliteNode(world);
    let result = aStarSearch(new ShrdliteGraph(), start, goalTest(intp), heuristics(intp), 15);
    if(result.status == "timeout")
        throw `TIMEOUT! Visited ${result.visited} nodes`;
    if(result.status == "failure")
        throw `No path exists from start to goal`;
    console.log(`Path with ${result.cost} moves (${result.visited} visited nodes)`);
    return result.path.map((incomingEdge) => incomingEdge.action);
}

// =======================================================================================
// HELPER FUNCTIONS ######################################################################
// =======================================================================================

/** Returns true if the needle string is part of the haystack array. */
function memberOf(needle : string, haystack : string[]) : boolean {
    return haystack.indexOf(needle) > -1;
}

/** Returns a deep clone of the given world state. */
function deepclone(state : WorldState) : WorldState {
    return {
      "stacks"  : JSON.parse(JSON.stringify(state.stacks)),
      "holding" : state.holding,
      "arm"     : state.arm,
      "objects" : state.objects,
      "examples": [], // examples are not needed for the planer
    };
}

/** Returns true if a drop of objA onto objB obeys the physical laws. */
function isValidDrop(objA : SimpleObject, objB : SimpleObject) : boolean {
    // Special case => anything can be dropped on the floor.
    if(objB.form == "floor") return true;
    // Nothing can be dropped on a ball.
    if(objB.form == "ball") return false;
    // A ball can't be dropped on anything else other than a box or the floor.
    if(objA.form == "ball" && objB.form != "box") return false;
    // A pyramid/plank/box cannot be dropped into a box of the same size.
    if(memberOf(objA.form, ["pyramid","plank","box"]) && objB.form == "box" && objA.size == objB.size) return false;
    // A large object cannot be dropped on a small object.
    if(objA.size == "large" && objB.size == "small") return false;

    if(objA.form == "box" && memberOf(objB.form, ["pyramid","brick"])) {
        // A small box cannot be dropped on a small brick/pyramid.
        if(objA.size == "small" && objB.size == "small") return false;
        // A large box cannot be dropped on a large pyramid.
        if(objA.size == "large" && objB.size == "large" && objB.form == "pyramid") return false;
    }
    return true; 
}

/** Returns x-y coordinates of an object on the world's stacks.
 *  Returns {-1,-1} if the object is the floor. 
 *  Returns null if the object is not on the world's stacks. */
function coordinate(obj : string, state : WorldState) : {x : number, y : number} | null {
    if(obj == "floor") return {"x" : -1, "y" : -1};
    for(let i : number = 0; i < state.stacks.length; ++i) {
        let j : number = state.stacks[i].indexOf(obj);
        if(j > -1) return {"x" : i, "y" : j};
    }
    return null;
}

/** Check if the literal (a unary relation) is true in the given world state. */
function isValidUnaryRelation(lit : Literal, state : WorldState) : boolean {
    if(lit.relation == "holding" && state.holding == lit.args[0]) return true;
    return false;
}

/** Check if the literal (a binary relation) is true in the given world state. */
function isValidBinaryRelation(lit : Literal, state : WorldState) : boolean {
    let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
    let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
    if(!coorA || !coorB) return false; // objects not on the stacks
    
    // Case 1: A and B are on the same stack of objects.
    if(lit.args[1] == "floor" || coorA.x == coorB.x) {
        if(lit.relation == "ontop"  && coorA.y == coorB.y + 1) return true;
        if(lit.relation == "inside" && coorA.y == coorB.y + 1) return true;
        if(lit.relation == "above"  && coorA.y > coorB.y) return true;
        if(lit.relation == "under"  && coorA.y < coorB.y) return true;
    } 
    // Case 2: A and B are on 2 different stacks of objects.
    else {
        if(lit.relation == "beside"  && Math.abs(coorA.x - coorB.x) == 1) return true;
        if(lit.relation == "leftof"  && coorA.x < coorB.x) return true;
        if(lit.relation == "rightof" && coorA.x > coorB.x) return true;
    }
    return false;
}

// =======================================================================================
// SHRDLITE NODE AND GRAPH ###############################################################
// =======================================================================================

/** Shrdlite node which stores a single state of the Shrdlite world. */
class ShrdliteNode {
    public id : string;
    public state : WorldState;

    constructor(state : WorldState) {
        let stringifiedStacks : string[] = [];
        for(let stack of state.stacks)
            stringifiedStacks.push(`[${stack.join(",")}]`);
        this.id = `${state.arm},${state.holding},[${stringifiedStacks.join(",")}]`;
        this.state = state;
    }
    public toString() : string { return this.id; }
    public compareTo(other : ShrdliteNode) { return this.id.localeCompare(other.id); }

    /* Returns the next node based on the action (or null if not possible). */
    public neighbor(action : string) : ShrdliteNode | null {
        let next = deepclone(this.state);
        let xpos = next.arm;
        let ypos = next.stacks[xpos].length - 1;

        if(action == 'l') {
            if(--next.arm < 0) return null;
        } else if(action == 'r') {
            if(++next.arm >= next.stacks.length) return null;
        } else if(action == 'p') {
            if(next.holding || ypos < 0) return null;
            next.holding = next.stacks[xpos][ypos];
            next.stacks[xpos].splice(ypos, 1);
        } else if(action == 'd' && next.holding) {
            let floor : SimpleObject = new SimpleObject("floor", null, null);
            let objA : SimpleObject = next.objects[next.holding]; 
            let objB : SimpleObject = (ypos < 0)? floor : next.objects[next.stacks[xpos][ypos]];
            if(!isValidDrop(objA, objB)) return null;
            next.stacks[xpos].push(next.holding);
            next.holding = null;
        } else {
            return null;
        }
        return new ShrdliteNode(next);
    }
}

/** Shrdlite graph which simply acts like an interface to create the nodes. */
class ShrdliteGraph implements Graph<ShrdliteNode> {
    compareNodes(a : ShrdliteNode, b : ShrdliteNode) : number {
        return a.compareTo(b);
    }
    successors(current : ShrdliteNode) : Successor<ShrdliteNode>[] {
        let outputs : Successor<ShrdliteNode>[] = [];
        ["l","r","p","d"].forEach((action) => {
            let next : ShrdliteNode | null = current.neighbor(action);
            if(next) outputs.push({"action": action, "child": next, "cost": 1});
        });
        return outputs;
    }
}

// ===============================================================================================
// GOAL TEST AND HEURISTICS ######################################################################
// ===============================================================================================

/** Returns a specialized goal test function */
function goalTest(intp : DNFFormula) : (node : ShrdliteNode) => boolean {
    return function(node : ShrdliteNode) : boolean {
        for(let conj of intp.conjuncts)
            if(isTrueConj(conj, node.state)) return true;
        return false;
    }
    function isTrueConj(conj : Conjunction, state : WorldState) : boolean {
        for(let lit of conj.literals)
            if(!isTrueLit(lit, state)) return false;
        return true;
    }
    function isTrueLit(lit : Literal, state : WorldState) : boolean {
        if(lit.args.length == 1)
            return isValidUnaryRelation(lit, state);
        if(lit.args.length == 2)
            return isValidBinaryRelation(lit, state);
        return false;
    }
}

/** Returns a specialized function to compute the heuristics */
function heuristics(intp : DNFFormula) : (node : ShrdliteNode) => number {
    return function(node : ShrdliteNode) : number {
        let heurs : number[] = intp.conjuncts.map((conj) => heurForConj(conj, node.state));
        return Math.min(...heurs);
    }
    function heurForConj(conj : Conjunction, state : WorldState) : number {
        let heurs : number[] = conj.literals.map((lit) => heurForLit(lit, state));
        return Math.max(...heurs);
    }
    function heurForLit(lit : Literal, state : WorldState) : number {
        if(lit.relation == "holding") return h_holding(lit,state);
        if(isValidBinaryRelation(lit,state)) 
            return 0;
        if(lit.relation == "leftof")  return h_left(lit,state);
        if(lit.relation == "rightof") return h_right(lit,state);
        if(lit.relation == "beside")  return h_beside(lit, state);
        if(lit.relation == "inside")  return h_inside(lit, state);
        if(lit.relation == "ontop")   return h_ontop(lit, state);
        if(lit.relation == "above")   return h_above(lit, state);
        if(lit.relation == "under")   return h_under(lit, state);
        return 0; // should never reach this point
    }
     
    // =======================================================
    // FUNCTIONS TO HANDLE CASE BY CASE ######################
    // =======================================================

    function h_holding(lit : Literal, state : WorldState) : number {
        let coor : {x:number,y:number} | null = coordinate(lit.args[0], state);
        if(coor) { // the object is on the stacks (i.e. not the goal yet)
            let n  = state.stacks[coor.x].length - coor.y - 1; // # objects on top the obj
            let dR = Math.abs(state.arm-coor.x);
            return 4*n + dR + 1;
        } else return 0; // this is the goal (i.e. currently holding the obj)
    }
    function h_left(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dR  = Math.min(Math.abs(state.arm-coorA.x), Math.abs(state.arm-coorB.x));
            let nA  = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            let nB  = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            return 4*(Math.min(nA,nB)) + dR + dAB + 3;
        } else if(coorA) { // the arm is holding B
            let dRA = state.arm - coorA.x;
            return (dRA > 0)? 1 : (-dRA + 2);
        } else if(coorB) { // the arm is holding A
            let dRB = state.arm - coorB.x;
            return (dRB < 0)? 1 : (dRB + 2);
        } else return 0; // should never reach this point
    }
    function h_right(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dR  = Math.min(Math.abs(state.arm-coorA.x), Math.abs(state.arm-coorB.x));
            let nA  = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            let nB  = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            return 4*(Math.min(nA,nB)) + dR + dAB + 3;
        } else if(coorA) { // the arm is holding B
            let dRA = state.arm - coorA.x;
            return (dRA < 0)? 1 : (dRA + 2);
        } else if(coorB) { // the arm is holding A
            let dRB = state.arm - coorB.x;
            return (dRB > 0)? 1 : (-dRB + 2);
        } else return 0; // should never reach this point
    }
    function h_beside(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dR  = Math.min(Math.abs(state.arm-coorA.x), Math.abs(state.arm-coorB.x));
            let nA  = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            let nB  = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            if(coorA.x == coorB.x) return 4*(Math.min(nA,nB)) + dR + 3;
            return 4*(Math.min(nA,nB)) + dR + dAB + 1;
        } else if(coorA) { // the arm is holding B
            return Math.abs(state.arm - coorA.x);
        } else if(coorB) { // the arm is holding A
            return Math.abs(state.arm - coorB.x);
        } else return 0; // should never reach this point
    }
    function h_inside(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dR  = Math.min(Math.abs(state.arm-coorA.x), Math.abs(state.arm-coorB.x));
            let nA  = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            let nB  = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            if(coorA.x == coorB.x) return 4*(Math.max(nA,nB)) + dR + 3;
            return 4*(nA+nB) + dR + dAB + 2;
        } else if(coorA) { // the arm is holding B
            let nA = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            return 4*nA + Math.abs(state.arm-coorA.x) + 4;
        } else if(coorB) { // the arm is holding A
            let nB = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            return 4*nB + Math.abs(state.arm-coorB.x) + 1;
        } else return 0; // should never reach this point
    }
    function h_ontop(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dR  = Math.min(Math.abs(state.arm-coorA.x), Math.abs(state.arm-coorB.x));
            let nA  = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            if(lit.args[1] == "floor") 
                return 4*nA + Math.abs(state.arm-coorA.x) + 3;
            let nB = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            if(coorA.x == coorB.x) return 4*(Math.max(nA,nB)) + dR + 3;
            return 4*(nA+nB) + dR + dAB + 2;
        } else if(coorA) { // the arm is holding B
            let nA = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            return 4*nA + Math.abs(state.arm-coorA.x) + 4;
        } else if(coorB) { // the arm is holding A
            if(lit.args[1] == "floor") return 1; // we at least have to drop it
            let nB = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            return 4*nB + Math.abs(state.arm-coorB.x) + 1;
        } else return 0; // should never reach this point
    }
    function h_above(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dRA = Math.abs(state.arm-coorA.x);
            let nA  = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            if(lit.args[1] == "floor") return 0; // already true
            return 4*nA + dAB + dRA + 3;
        } else if(coorA) { // the arm is holding B
            let nA = state.stacks[coorA.x].length - coorA.y - 1; // # objects on top A
            return 4*nA + Math.abs(state.arm-coorA.x) + 4;
        } else if(coorB) { // the arm is holding A
            if(lit.args[1] == "floor") return 1; // we at least have to drop it
            return Math.abs(state.arm-coorB.x) + 1;
        } else return 0; // should never reach this point
    }
    function h_under(lit : Literal, state : WorldState) : number {
        let coorA : {x:number,y:number} | null = coordinate(lit.args[0], state);
        let coorB : {x:number,y:number} | null = coordinate(lit.args[1], state);
        if(coorA && coorB) { // both A and B are on the stacks (floor included)
            let dAB = Math.abs(coorA.x-coorB.x);
            let dRB = Math.abs(state.arm-coorB.x);
            let nB  = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            return 4*nB + dAB + dRB + 3;
        } else if(coorA) { // the arm is holding B
            return Math.abs(state.arm-coorA.x) + 1;
        } else if(coorB) { // the arm is holding A
            let nB = state.stacks[coorB.x].length - coorB.y - 1; // # objects on top B
            return 4*nB + Math.abs(state.arm-coorB.x) + 4;
        } else return 0; // should never reach this point
    }
}

// TODO: Documentation for heuristics function (symbols + explanations)