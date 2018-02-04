
import { WorldState } from "./World";

import {
    ShrdliteResult,
    Command, TakeCommand, DropCommand, MoveCommand,
    Location, Entity,
    Object, RelativeObject, SimpleObject,
    DNFFormula, Conjunction, Literal,
} from "./Types";

import Dictionary from "./lib/typescript-collections/src/lib/Dictionary";

/********************************************************************************
** Interpreter

The goal of the Interpreter module is to interpret a sentence
written by the user in the context of the current world state. 
In particular, it must figure out which objects in the world,
i.e. which elements in the 'objects' field of WorldState, correspond
to the ones referred to in the sentence. 

Moreover, it has to derive what the intended goal state is and
return it as a logical formula described in terms of literals, where
each literal represents a relation among objects that should
hold. For example, assuming a world state where "a" is a ball and
"b" is a table, the command "put the ball on the table" can be
interpreted as the literal ontop(a,b). More complex goals can be
written using conjunctions and disjunctions of these literals.
 
In general, the module can take a list of possible parses and return
a list of possible interpretations, but the code to handle this has
already been written for you. The only part you need to implement is
the core interpretation function, namely 'interpretCommand', which 
produces a single interpretation for a single command.

You should implement the function 'interpretCommand'. 
********************************************************************************/

//////////////////////////////////////////////////////////////////////
// exported functions, classes and interfaces/types

/* Top-level function for the Interpreter. 
 * It calls 'interpretCommand' for each possible parse of the command. 
 * You don't have to change this function.
 *
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


/* The core interpretation class. 
 * The code here are just templates; you should rewrite this class entirely. 
 * In this template, the code produces a dummy interpretation which is 
 * not connected to the input 'cmd'. Your version of the class should
 * analyse 'cmd' in order to figure out what interpretation to return.
 */

class Interpreter {
    constructor(
        private world: WorldState

    ) { }

    /* The main interpretation method.
     * Note that you should not change the API (type) of this method, only its body.
     * This method should call the mutually recursive methods 
     * 'interpretEntity', 'interpretLocation' and 'interpretObject'
     *
     * @param cmd: An object of type 'Command'.
     * @returns: A DNFFormula representing the interpretation of the user's command.
     *           If there's an interpretation error, it throws an error with a string description.
     */

    public interpretCommand(cmd: Command): CommandSemantics {
        // This currently returns a dummy interpretation involving one or two random objects in the world.
        // Instead it should call the other interpretation methods for
        // each of its arguments (cmd.entity and/or cmd.location).
        var interpretation: CommandSemantics;
        // this.interpretEntity(cmd)
        var all_objects: string[] = Array.prototype.concat.apply([], this.world.stacks);
        if (this.world.holding) {
            all_objects.push(this.world.holding);
        }
        if (cmd instanceof MoveCommand) {
            this.interpretEntity(cmd.entity);
            var a = all_objects[Math.floor(Math.random() * all_objects.length)];
            var b = all_objects[Math.floor(Math.random() * all_objects.length)];
            if (a == b) {
                throw "Cannot put an object ontop of itself";
            }

            interpretation = new DNFFormula([
                new Conjunction([
                    new Literal("ontop", [a, b]),
                    new Literal("ontop", [b, "floor"])
                ])
            ]);
        }

        else if (cmd instanceof TakeCommand) {
            var a = all_objects[Math.floor(Math.random() * all_objects.length)];
            interpretation = new DNFFormula([
                new Conjunction([ // holding(a)
                    new Literal("holding", [a])
                ])
            ]);
        }

        else if (cmd instanceof DropCommand) {
            if (!this.world.holding) {
                throw "I'm not holding anything";
            }
            var a = this.world.holding;
            var b = all_objects[Math.floor(Math.random() * all_objects.length)];
            if (a == b) {
                throw "Cannot put an object ontop of itself";
            }
            interpretation = new DNFFormula([
                new Conjunction([ // ontop(a, b)
                    new Literal("ontop", [a, b])
                ])
            ]);
        }

        else {
            throw "Unknown command";
        }
        return interpretation;
    }



    interpretEntity(ent: Entity): EntitySemantics {
        var obj: ObjectSemantics = this.interpretObject(ent.object);
        throw "Not implemented";
    }

    interpretLocation(loc: Location): LocationSemantics {
        throw "Not implemented";
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
            }
            else if (obj instanceof RelativeObject) {

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

                objects.forEach(function (key) {
                    stackPosKey = stackPositions.getValue(key);
                    indexPosKey = indexPositions.getValue(key);
                    let isValid: boolean = true;
                    location.entity.object.forEach(function (locationKey) {
                        stackPosLocation = stackPositions.getValue(locationKey);
                        indexPosLocation = indexPositions.getValue(locationKey);
                        if (stackPosKey && stackPosLocation && indexPosKey && indexPosLocation) {
                            switch (location.relation) {
                                case "ontopof":
                                case "inside":
                                    if (stackPosKey == stackPosLocation && indexPosLocation + 1 == indexPosKey) {
                                        if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) != -1)
                                            result.push(key);
                                        else if (location.entity.quantifier == "all")
                                            throw 'Things can only be $(location.relation) exactly one object';
                                    }
                                    break;
                                case "leftof":
                                    if (stackPosKey < stackPosLocation) {
                                        if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) != -1)
                                            result.push(key);
                                    }
                                    else
                                        isValid = false;
                                    break;
                                case "rightof":
                                    if (stackPosKey > stackPosLocation) {
                                        if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) != -1)
                                            result.push(key);
                                    }
                                    else
                                        isValid = false;
                                    break;
                                case "under":
                                    if (stackPosKey == stackPosLocation && indexPosKey < indexPosLocation) {
                                        if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) != -1)
                                            result.push(key);
                                    }
                                    else
                                        isValid = false;
                                    break;
                                case "above":
                                    if (stackPosKey == stackPosLocation && indexPosKey > indexPosLocation && result.indexOf(key) == -1) {
                                        if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) != -1)
                                            result.push(key);
                                    }
                                    else
                                        isValid = false;
                                    break;
                                case "beside":
                                    if (stackPosKey == stackPosLocation - 1 || stackPosKey == stackPosLocation + 1) {
                                        if ((location.entity.quantifier == "any" || location.entity.quantifier == "the") && result.indexOf(key) != -1)
                                            result.push(key);
                                    }
                                    else
                                        isValid = false;
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

