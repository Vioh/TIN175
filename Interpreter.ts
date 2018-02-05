
/********************************************************************************
The goal of the Interpreter module is to interpret a sentence written by the user
in the context of the current world state. In particular, it must figure out which
objects in the world (i.e. which elements in the "objects" field of WorldState)
correspond to the ones referred to in the sentence.

Moreover, it has to derive what the intended goal state is and return it as a 
logical formula described in terms of literals, where each literal represents a 
relation among objects that should hold. For example, assuming a world state 
where "a" is a ball and "b" is a table, the command "put the ball on the table" 
can be interpreted as the literal ontop(a,b). More complex goals can be written 
using conjunctions and disjunctions of these literals. 

In general, the module can take a list of possible parses and return a list of 
possible interpretations. The core interpretation function ("interpretCommand")
should produce a single itnerpretation for a single command.
********************************************************************************/

import Set from "./lib/typescript-collections/src/lib/Set";
import {WorldState} from "./World";
import {
    ShrdliteResult,
    Command, TakeCommand, DropCommand, MoveCommand,
    Location, Entity,
    Object, RelativeObject, SimpleObject,
    DNFFormula, Conjunction, Literal,
} from "./Types";

/** DNF formula is the main interpretation result. */
type CommandSemantics = DNFFormula

/** Semantics of an object is a collection of objects that match the description. */
type ObjectSemantics = string[]

/** Semantics of Entity is a wrapper around semantics of its children. */
type EntitySemantics = {quantifier : string; object : ObjectSemantics}

/** Semantics of Location is a wrapper around semantics of its children. */
type LocationSemantics = {relation : string; entity : EntitySemantics}

/**
 * Top-level function for the Interpreter
 * It calls 'interpretCommand' for each possible parse of the command. 
 * You don't have to change this function.
 * @param parses: List of parses produced by the Parser.
 * @param world: The current state of the world.
 * @returns: List of interpretation results, which are the parse results augmented 
 *           with interpretations. Each interpretation is represented by a DNFFormula.
 *           If there's an interpretation error, it throws an error with a string description.
 */
export function interpret(parses : ShrdliteResult[], world : WorldState) : ShrdliteResult[] {
    var errors : string[] = [];
    var interpretations : ShrdliteResult[] = [];
    var interpreter : Interpreter = new Interpreter(world);
    for (var result of parses) {
        try {
            var intp : DNFFormula = interpreter.interpretCommand(result.parse);
        } catch(err) {
            errors.push(err);
            continue;
        }
        result.interpretation = intp;
        interpretations.push(result);
    };
    if (interpretations.length == 0) {
        // merge all errors into one
        throw errors.join(" ; ");
    }
    return interpretations;
}

// ===============================================================================================
// ===============================================================================================
// ===============================================================================================

/** Helper function that returns true if needle is in the haystack. */
function memberOf(needle : string, haystack : string[]) : boolean {
    return haystack.indexOf(needle) > -1;
}

/** The core interpretation class. */
class Interpreter {
    constructor(
        private world : WorldState
    ) {}

    /** Returns an interpretation (DNF formula) of a command. */
    public interpretCommand(cmd : Command) : CommandSemantics {
        
        if(cmd instanceof MoveCommand) {
            let loc  : LocationSemantics = this.interpretLocation(cmd.location);
            let entA : EntitySemantics = this.interpretEntity(cmd.entity);
            let entB : EntitySemantics = loc.entity;
            return this.handleQuantifiers(entA.object, entB.object, entA.quantifier, entB.quantifier, loc.relation);
        }
        if(cmd instanceof DropCommand) {
            let loc : LocationSemantics = this.interpretLocation(cmd.location);
            let ent : EntitySemantics = loc.entity;
            if(!this.world.holding) throw `I'm not holding anything`;
            return this.handleQuantifiers([this.world.holding], ent.object, "any", ent.quantifier, loc.relation);
        }
        if(cmd instanceof TakeCommand) {
            let conjunctions : Conjunction[] = [];
            let ent : EntitySemantics = this.interpretEntity(cmd.entity);

            // Error handlings for all the quantifiers.
            if(ent.object.length == 0) throw `Couldn't find any matching object`;
            if(ent.object.indexOf("floor") > -1) throw `I cannot take the floor`;
            if(ent.object.length != 1) {
                if(ent.quantifier == "the") throw `Found too many matching objects`;
                if(ent.quantifier == "all") throw `I cannot take more than one object`;
            }
            // Create conjunctions for the interpreting.
            for(let x of ent.object) 
                conjunctions.push(new Conjunction([new Literal("holding", [x])]));
            return new DNFFormula(conjunctions);
        }
        throw "Unknown command";
    }

    /** Main interpretation method that takes the quantifiers into account. */
    handleQuantifiers (
        objectsA : string[],   // set of all matching objects (called A)
        objectsB : string[],   // set of all matching locations (called B)
        quanA    : string,     // quantifier for A
        quanB    : string,     // quantifier for B
        rel      : string,     // spatial relation between A and B
    ) : DNFFormula {
        
        let errors : Set<string> = new Set<string>(); // set prevents duplicating errors
        let conjunctions : Conjunction[] = [];

        // Pre-processing of the quantifiers, and throw errors if necessary.
        if(objectsA.length == 0) throw `Couldn't find any matching object`;
        if(objectsB.length == 0) throw `Couldn't find any matching destination`;
        if(quanA == "the" && objectsA.length > 1) 
            throw `Too many matching objects for "the" quantifier`;
        if(quanB == "the" && objectsB.length > 1) 
            throw `Too many matching destinations for "the" quantifier`;
        if(memberOf(rel, ["ontop", "inside"])) {
            if(quanB == "all" && objectsB.length > 1 && objectsB[0] != "floor")
                throw `Things can only be ${rel} exactly one object`;
            if(quanA == "all" && objectsA.length > 1) throw `Only 1 thing can be ${rel} another object`;
        }
        // Interpret when both quantifiers are "all".
        if(quanA == "all" && quanB == "all") {
            let literals : Literal[] = [];
            objectsA.forEach((a) => {
                objectsB.forEach((b) => {
                    let err = this.validate(rel,a,b).error;
                    if(err) errors.add(err); // physical law violation
                    else literals.push(new Literal(rel,[a,b]));
                });
            });
            conjunctions.push(new Conjunction(literals));
        }
        // Interpret when only the 1st quantifier is "all".
        else if(quanA == "all") {
            objectsB.forEach((b) => {
                let literals : Literal[] = [];
                objectsA.forEach((a) => {
                    let err = this.validate(rel,a,b).error;
                    if(err) errors.add(err); // physical law violation
                    else literals.push(new Literal(rel,[a,b]));
                });
                conjunctions.push(new Conjunction(literals));
            });
        }
        // Interpret when only the 2nd quantifier is "all". 
        else if(quanB == "all") {
            objectsA.forEach((a) => {
                let literals : Literal[] = [];
                objectsB.forEach((b) => {
                    let err = this.validate(rel,a,b).error;
                    if(err) errors.add(err); // physical law violation
                    else literals.push(new Literal(rel,[a,b]));
                });
                conjunctions.push(new Conjunction(literals));
            });
        }
        // Interpret when none of the quantifiers are "all"
        else {
            objectsA.forEach((a) => {
                let literals : Literal[] = [];
                objectsB.forEach((b) => {
                    let err = this.validate(rel,a,b).error;
                    if(err) errors.add(err); // physical law violation
                    else conjunctions.push(new Conjunction([new Literal(rel,[a,b])]));
                });
            });
        }
        // Output the DNFFormula, or throw an error if there are no conjunctions.
        if(conjunctions.length == 0)
            throw errors.toArray().join("; "); // merge all errors into one
        return new DNFFormula(conjunctions);
    }

    /** Validate and returns an error message if a physical law is violated.  */
    validate(rel : string, obj1 : string, obj2 : string) : {error?: string} {
        let floor : SimpleObject = new SimpleObject("floor", null, null);
        let a : SimpleObject = (obj1 == "floor")? floor : this.world.objects[obj1];
        let b : SimpleObject = (obj2 == "floor")? floor : this.world.objects[obj2];

        // Test physical laws relating to the floor.
        if(a.form == "floor")
            return {error: "I cannot take the floor"};
        if(b.form == "floor" && memberOf(rel, ["under","leftof","rightof","beside","inside"]))
            return {error: `Nothing can be ${rel} the floor.`};

        // TODO: Should this testing be done here or before the validation???
        // The command must refer to 2 distinct objects in the world.
        if(obj1 == obj2) return {error: `Nothing can be ${rel} itself`};

        // A ball can be on top of ONLY the floor (otherwise they roll away).
        if(a.form == "ball" && b.form != "floor" && rel == "ontop")
            return {error: `A ball can only be ontop the floor`};

        // A ball cannot support anything.
        if(a.form == "ball" && rel == "under")
            return {error: `A ball cannot be under anything`};
        if(b.form == "ball" && memberOf(rel, ["ontop","above"]))
            return {error: `Nothing can be ${rel} a ball`};

        // Objects are "inside" boxes, but "ontop" of other objects
        if(b.form != "box" && rel == "inside")
            return {error: `Nothing can be inside a ${b.form}`};
        if(b.form == "box" && rel == "ontop")
            return {error: `Nothing can be ontop a box`};

        // Boxes cannot contain pyramids, planks or boxes of the same size.
        if(memberOf(a.form, ["pyramid","plank","box"]) && b.form == "box" && rel == "inside")
            if(a.size == b.size) return {error: `A ${a.form} cannot be inside a box of the same size`};

        if(a.form == "box" && memberOf(b.form, ["pyramid","brick"]) && rel == "ontop")
            // Small boxes cannot be supported by small bricks or pyramids.
            if(a.size == "small" && b.size == "small")
                return {error: `A small box cannot be ontop a small ${b.form}`};
            // Large boxes cannot be supported by large pyramids.
            if(a.size == "large" && b.size == "large" && b.form == "pyramid")
                return {error: `A large box cannot be ontop a large pyramid`};

        // Small objects cannot support large objects. 
        if(memberOf(rel, ["inside","ontop"]) && a.size == "large" && b.size == "small")
            return {error: `A large object cannot be ${rel} a small one`};

        return {error: undefined}; // Reaching here means that no physical law is violated.
    }

    /** Returns an interpretation for an object. */
    interpretObject(obj : Object) : ObjectSemantics {
        if(obj instanceof SimpleObject) return this.interpretSimpleObject(obj);
        if(obj instanceof RelativeObject) return this.interpretRelativeObject(obj);
        throw "Unknown object";
    }

    /** Returns an interpretation for a simple object. */
    interpretSimpleObject(obj : SimpleObject) : ObjectSemantics {
        if(obj.form == "floor") return ["floor"];     // returns immediately if it's the floor
        let output : Set<string> = new Set<string>(); // set of matched objects (non-duplicating)
        
        // Returns true if 2 simple objects have the same properties. 
        function isMatched(x : SimpleObject) : boolean {
            return (obj.form  == "anyform" || obj.form  == x.form) 
                    && (obj.size  == null  || obj.size  == x.size)
                    && (obj.color == null  || obj.color == x.color);
        }
        // Get all objects available in the world.
        let all_objects : string[] = Array.prototype.concat.apply([], this.world.stacks);
        if(this.world.holding) {
            all_objects.push(this.world.holding);
        }
        // Find matching objects in the world.
        let defined_objects = this.world.objects;
        Object.keys(defined_objects).forEach(function(key) {
            // skip if the object (key) is not visible in the world
            if(memberOf(key, all_objects)) return; 
            // add to output if the object (key) matches the description
            if(isMatched(defined_objects[key])) output.add(key);
        });
        return output.toArray();
    }

    /** Returns an interpretation for a relative object. */
    interpretRelativeObject(obj : RelativeObject) : ObjectSemantics {
        let stacks : string[][] = this.world.stacks;

        // TODO: Using set instead of array here for matched?
        let matched : ObjectSemantics = []; // output (the matched objects to be returned)
        
        // Interpret components of a relative object.
        let location : LocationSemantics = this.interpretLocation(obj.location);
        let objectsA : ObjectSemantics = this.interpretObject(obj.object);
        let objectsB : ObjectSemantics = location.entity.object;
        let relation : string = location.relation;

        // Returns the x-y coordinate of an object in the stacks.
        function coordinate(obj : string) : {x : number, y : number} {
            for(let i : number = 0; i < stacks.length; ++i) {
                let j : number = stacks[i].indexOf(obj);
                if(j > -1) return {"x" : i, "y" : j};
            }
            return {"x" : -1, "y" : -1}; // this should never occur
        }
        // Check if rel(a,b) is a true propositional logic formula.
        function checkRelation(rel : string, a : string, b : string) : boolean {
            let coorA = coordinate(a);
            let coorB = coordinate(b);

            if(coorA.x == coorB.x) { // both 'a' and 'b' are on the same stack of objects
                if(rel == "ontop"  && coorA.y == coorB.y + 1) return true;
                if(rel == "inside" && coorA.y == coorB.y + 1) return true;
                if(rel == "above"  && coorA.y > coorB.y) return true;
                if(rel == "under"  && coorA.y < coorB.y) return true;
            } else { // 'a' and 'b' are on 2 different stacks of objects
                if(rel == "beside"  && Math.abs(coorA.x - coorB.x) == 1) return true;
                if(rel == "leftof"  && coorA.x < coorB.x) return true;
                if(rel == "rightof" && coorA.x > coorB.x) return true;
            }
            return false;
        }
        // Actual interpretation.
        for(let a of objectsA) {
            for(let b of objectsB) {
                if(this.validate(a,b,relation).error) continue;
                if(checkRelation(relation,a,b)) matched.push(a);
            }
        }
        return matched;
    }

    /** Returns an interpretation for an entity. */
    interpretEntity(ent : Entity) : EntitySemantics {
        let obj : ObjectSemantics = this.interpretObject(ent.object);
        return { "quantifier" : ent.quantifier, "object" : obj };
    }

    /** Returns an interpretation for a location. */
    interpretLocation(loc : Location) : LocationSemantics {
        let ent : EntitySemantics = this.interpretEntity(loc.entity);
        return { "relation" : loc.relation, "entity" : ent };
    }
}
/*******************************************************************************
TODO: Check all the TODOs in this file!!!
- Make sure that all calls to validate() has the correct order of arguments.
- Quantifiers:
    the => the => ent1.length == 1 AND ent2.length == 1
    the => any => ent1.length == 1
    any => the => ent2.length == 1
    any => any => No AND in conjunctions
    ============================================
    any => all =>
        ontop/inside (ent2.length == 1)
        under/above/leftof/rightof (conjunctions with AND)
    the => all => ent1.length == 1
        ontop/inside (ent2.length == 1)
        under/above/leftof/rightof (conjunctions with AND)
    all => the => ent2.length == 1
        floor (conjunctions with AND)
        ontop/inside (ent2.length == 1)
        under/above/leftof/rightof (conjunctions with AND)
    all => any =>
        ontop/inside (ent2.length == 1)
        under/above/leftof/rightof (conjunctions with AND)
    all => all =>
        ontop/inside (ent1.length > 1)? => Only 1 thing can be ${rel} another object.
        ontop/inside (ent2.length > 1)? => Things can only be ${rel} exactly one object.
        else => OK
        under/above/leftof/rightof (conjunctions with AND)
- Relations:
    support(ontop, under, above, inside), leftof, rightof, beside
- Make sure that the matched objects actually exist in the stacks (all_objects)
- Failed test cases: 30, 39
- Problems with test cases: 3, 16
*******************************************************************************/