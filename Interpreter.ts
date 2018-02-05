
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
import { WorldState } from "./World";
import {
    ShrdliteResult,
    Command, TakeCommand, DropCommand, MoveCommand,
    Location, Entity,
    Object, RelativeObject, SimpleObject,
    DNFFormula, Conjunction, Literal,
} from "./Types";
import Dictionary from "./lib/typescript-collections/src/lib/Dictionary";


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
export function interpret(parses: ShrdliteResult[], world: WorldState): ShrdliteResult[] {
    var errors: string[] = [];
    var interpretations: ShrdliteResult[] = [];
    var interpreter: Interpreter = new Interpreter(world);
    for (var result of parses) {
        try {
            var intp: DNFFormula = interpreter.interpretCommand(result.parse);
        } catch (err) {
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
function memberOf(needle: string, haystack: string[]): boolean {
    return haystack.indexOf(needle) > -1;
}

/** The core interpretation class. */
class Interpreter {
    constructor(
        private world: WorldState
    ) { };

    /** Returns an interpretation (DNF formula) of a command. */
    public interpretCommand(cmd: Command): CommandSemantics {

        if (cmd instanceof MoveCommand) {
            let loc: LocationSemantics = this.interpretLocation(cmd.location);
            let entA: EntitySemantics = this.interpretEntity(cmd.entity);
            let entB: EntitySemantics = loc.entity;
            return this.handleQuantifiers(entA.object, entB.object, entA.quantifier, entB.quantifier, loc.relation);
        }
        if (cmd instanceof DropCommand) {
            let loc: LocationSemantics = this.interpretLocation(cmd.location);
            let ent: EntitySemantics = loc.entity;
            if (!this.world.holding) throw `I'm not holding anything`;
            return this.handleQuantifiers([this.world.holding], ent.object, "any", ent.quantifier, loc.relation);
        }
        if (cmd instanceof TakeCommand) {
            let conjunctions: Conjunction[] = [];
            let ent: EntitySemantics = this.interpretEntity(cmd.entity);

            // Error handlings for all the quantifiers.
            if (ent.object.length == 0) throw `Couldn't find any matching object`;
            if (ent.object.indexOf("floor") > -1) throw `I cannot take the floor`;
            if (ent.object.length != 1) {
                if (ent.quantifier == "the") throw `Found too many matching objects`;
                if (ent.quantifier == "all") throw `I cannot take more than one object`;
            }
            // Create conjunctions for the interpreting.
            for (let x of ent.object)
                conjunctions.push(new Conjunction([new Literal("holding", [x])]));
            return new DNFFormula(conjunctions);
        }
        throw "Unknown command";
    }

    /** Main interpretation method that takes the quantifiers into account. */
    handleQuantifiers(
        objectsA: string[],   // set of all matching objects (called A)
        objectsB: string[],   // set of all matching locations (called B)
        quanA: string,     // quantifier for A
        quanB: string,     // quantifier for B
        rel: string,     // spatial relation between A and B
    ): DNFFormula {

        let errors: Set<string> = new Set<string>(); // set prevents duplicating errors
        let conjunctions: Conjunction[] = [];

        // Pre-processing of the quantifiers, and throw errors if necessary.
        if (objectsA.length == 0) throw `Couldn't find any matching object`;
        if (objectsB.length == 0) throw `Couldn't find any matching destination`;
        if (quanA == "the" && objectsA.length > 1)
            throw `Too many matching objects for "the" quantifier`;
        if (quanB == "the" && objectsB.length > 1)
            throw `Too many matching destinations for "the" quantifier`;
        if (memberOf(rel, ["ontop", "inside"])) {
            if (quanB == "all" && objectsB.length > 1 && objectsB[0] != "floor")
                throw `Things can only be ${rel} exactly one object`;
            if (quanA == "all" && objectsA.length > 1) throw `Only 1 thing can be ${rel} another object`;
        }
        // Interpret when both quantifiers are "all".
        if (quanA == "all" && quanB == "all") {
            let literals: Literal[] = [];
            objectsA.forEach((a) => {
                objectsB.forEach((b) => {
                    let err = this.validate(rel, a, b).error;
                    if (err) errors.add(err); // physical law violation
                    else literals.push(new Literal(rel, [a, b]));
                });
            });
            conjunctions.push(new Conjunction(literals));
        }
        // Interpret when only the 1st quantifier is "all".
        else if (quanA == "all") {
            objectsB.forEach((b) => {
                let literals: Literal[] = [];
                objectsA.forEach((a) => {
                    let err = this.validate(rel, a, b).error;
                    if (err) errors.add(err); // physical law violation
                    else literals.push(new Literal(rel, [a, b]));
                });
                conjunctions.push(new Conjunction(literals));
            });
        }
        // Interpret when only the 2nd quantifier is "all". 
        else if (quanB == "all") {
            objectsA.forEach((a) => {
                let literals: Literal[] = [];
                objectsB.forEach((b) => {
                    let err = this.validate(rel, a, b).error;
                    if (err) errors.add(err); // physical law violation
                    else literals.push(new Literal(rel, [a, b]));
                });
                conjunctions.push(new Conjunction(literals));
            });
        }
        // Interpret when none of the quantifiers are "all"
        else {
            objectsA.forEach((a) => {
                let literals: Literal[] = [];
                objectsB.forEach((b) => {
                    let err = this.validate(rel, a, b).error;
                    if (err) errors.add(err); // physical law violation
                    else conjunctions.push(new Conjunction([new Literal(rel, [a, b])]));
                });
            });
        }
        // Output the DNFFormula, or throw an error if there are no conjunctions.
        if (conjunctions.length == 0)
            throw errors.toArray().join("; "); // merge all errors into one
        return new DNFFormula(conjunctions);
    }

    /** Validate and returns an error message if a physical law is violated.  */
    validate(rel: string, obj1: string, obj2: string): { error?: string } {
        let floor: SimpleObject = new SimpleObject("floor", null, null);
        let a: SimpleObject = (obj1 == "floor") ? floor : this.world.objects[obj1];
        let b: SimpleObject = (obj2 == "floor") ? floor : this.world.objects[obj2];

        // Test physical laws relating to the floor.
        if (a.form == "floor")
            return { error: "I cannot take the floor" };
        if (b.form == "floor" && memberOf(rel, ["under", "leftof", "rightof", "beside", "inside"]))
            return { error: `Nothing can be ${rel} the floor.` };

        // A ball can be on top of ONLY the floor (otherwise they roll away).
        if (a.form == "ball" && b.form != "floor" && rel == "ontop")
            return { error: `A ball can only be ontop the floor` };

        // A ball cannot support anything.
        if (a.form == "ball" && rel == "under")
            return { error: `A ball cannot be under anything` };
        if (b.form == "ball" && memberOf(rel, ["ontop", "above"]))
            return { error: `Nothing can be ${rel} a ball` };

        // Objects are "inside" boxes, but "ontop" of other objects
        if (b.form != "box" && rel == "inside")
            return { error: `Nothing can be inside a ${b.form}` };
        if (b.form == "box" && rel == "ontop")
            return { error: `Nothing can be ontop a box` };

        // Boxes cannot contain pyramids, planks or boxes of the same size.
        if (memberOf(a.form, ["pyramid", "plank", "box"]) && b.form == "box" && rel == "inside")
            if (a.size == b.size) return { error: `A ${a.form} cannot be inside a box of the same size` };

        if (a.form == "box" && memberOf(b.form, ["pyramid", "brick"]) && rel == "ontop")
            // Small boxes cannot be supported by small bricks or pyramids.
            if (a.size == "small" && b.size == "small")
                return { error: `A small box cannot be ontop a small ${b.form}` };
        // Large boxes cannot be supported by large pyramids.
        if (a.size == "large" && b.size == "large" && b.form == "pyramid")
            return { error: `A large box cannot be ontop a large pyramid` };

        // Small objects cannot support large objects. 
        if (memberOf(rel, ["inside", "ontop"]) && a.size == "large" && b.size == "small")
            return { error: `A large object cannot be ${rel} a small one` };

        // TODO: Should this testing be done here or before the validation???
        // The command must refer to 2 distinct objects in the world.
        if (obj1 == obj2) return { error: `Nothing can be ${rel} itself` };

        return { error: undefined }; // Reaching here means that no physical law is violated.
    }



    interpretObject(obj: Object): ObjectSemantics {
        try {
            let result: ObjectSemantics = [];
            let items: { [s: string]: SimpleObject } = this.world.objects;

            //function to compare size of two SimpleObject
            let size = function (x: SimpleObject, y: SimpleObject): boolean {
                return ((x.size && x.size == y.size) || (!x.size));
            }
            //function to compare color of two SimpleObject
            let color = function (x: SimpleObject, y: SimpleObject): boolean {
                return ((x.color && x.color == y.color) || (!x.color));
            }
            if (obj instanceof SimpleObject) {
                let simpleObj: SimpleObject;
                for (var key in items) {
                    simpleObj = items[key];
                    if (obj.form == "anyform" && size(obj, simpleObj) && color(obj, simpleObj)) {
                        result.push(key);
                    }
                    else {
                        if (obj.form == simpleObj.form && size(obj, simpleObj) && color(obj, simpleObj)) {
                            result.push(key);
                        }
                    }
                }
                if (obj.form == "floor")
                    result.push("floor");
            }
            else if (obj instanceof RelativeObject) {
                //console.log("Nickey");
                //variable declaration
                let stackPositions: Dictionary<string, number> = new Dictionary(); //to keep stack position of an object
                let indexPositions: Dictionary<string, number> = new Dictionary(); //to keep the index position of an object in a stack
                let objects: ObjectSemantics = this.interpretObject(obj.object);
                let location: LocationSemantics = this.interpretLocation(obj.location);
                let stackPosKey: number | undefined;
                let stackPosLocation: number | undefined;
                let indexPosKey: number | undefined;
                let indexPosLocation: number | undefined;

                //loading the dictionaries based on the current world state
                this.world.stacks.forEach(function (items, stackPos) {
                    items.forEach(function (item, indexPos) {
                        stackPositions.setValue(item, stackPos);
                        indexPositions.setValue(item, indexPos);
                    });
                });
                let thisPtr: Interpreter = this;
                objects.forEach(function (key) {
                    stackPosKey = stackPositions.getValue(key);
                    indexPosKey = indexPositions.getValue(key);
                    let isValid: boolean = true;
                    //let thisPointer: Interpreter = this as Interpreter;
                    location.entity.object.forEach(function (locationKey) {
                        if (!(thisPtr.validate(location.relation,key, locationKey).error)) {
                            stackPosLocation = (locationKey != "floor") ? stackPositions.getValue(locationKey) : stackPosKey;
                            indexPosLocation = (locationKey != "floor") ? indexPositions.getValue(locationKey) : -1;
                            if (stackPosKey != undefined && stackPosLocation != undefined && indexPosKey != undefined && indexPosLocation != undefined) {
                                switch (location.relation) {
                                    case "ontop":
                                    case "inside":
                                        if (stackPosKey == stackPosLocation && indexPosLocation + 1 == indexPosKey) {
                                            //console.log(location.entity.quantifier + "/" + result.indexOf(key));
                                            if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) == -1)
                                                result.push(key);
                                            else if (location.entity.quantifier == "all")
                                                throw 'Things can only be $(location.relation) exactly one object';
                                        }
                                        //console.log(result);
                                        break;
                                    case "leftof":
                                        if (stackPosKey < stackPosLocation) {
                                            if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) == -1)
                                                result.push(key);
                                        }
                                        else
                                            isValid = false;
                                        break;
                                    case "rightof":
                                        if (stackPosKey > stackPosLocation) {
                                            if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) == -1)
                                                result.push(key);
                                        }
                                        else
                                            isValid = false;
                                        break;
                                    case "under":
                                        if (stackPosKey == stackPosLocation && indexPosKey < indexPosLocation) {
                                            if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) == -1)
                                                result.push(key);
                                        }
                                        else
                                            isValid = false;
                                        break;
                                    case "above":
                                        if (stackPosKey == stackPosLocation && indexPosKey > indexPosLocation) {
                                            if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) == -1)
                                                result.push(key);
                                        }
                                        else
                                            isValid = false;
                                        break;
                                    case "beside":
                                        if (stackPosKey == stackPosLocation - 1 || stackPosKey == stackPosLocation + 1) {
                                            if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) == -1)
                                                result.push(key);
                                        }
                                        else
                                            isValid = false;
                                }
                            }
                        }

                    });
                    if (location.entity.quantifier == "all" && isValid)
                        result.push(key);
                });
            }
            if (result.length == 0)
                throw "Couldn't find any matching object";
            return result;
        }
        catch (err) {
            throw err;
        }
    }

    /** Returns an interpretation for an entity. */
    interpretEntity(ent: Entity): EntitySemantics {
        let obj: ObjectSemantics = this.interpretObject(ent.object);
        return { "quantifier": ent.quantifier, "object": obj };
    }

    /** Returns an interpretation for a location. */
    interpretLocation(loc: Location): LocationSemantics {
        let ent: EntitySemantics = this.interpretEntity(loc.entity);
        return { "relation": loc.relation, "entity": ent };
    }
}


//////////////////////////////////////////////////////////////////////
// These are suggestions for semantic representations 
// of the different parse result classes.

// This is the main interpretation result, a DNF formula
type CommandSemantics = DNFFormula

// The semantics of an object description is a collection of
// the objects that match the description
type ObjectSemantics = string[]

// The semantics of an Entity or a Location is just a wrapper
// around the semantics of its children
type EntitySemantics = { quantifier: string; object: ObjectSemantics }
type LocationSemantics = { relation: string; entity: EntitySemantics }

