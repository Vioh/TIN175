
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

import {WorldState} from "./World";
import {
    ShrdliteResult,
    Command, TakeCommand, DropCommand, MoveCommand,
    Location, Entity,
    Object, RelativeObject, SimpleObject,
    DNFFormula, Conjunction, Literal,
} from "./Types";

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

/*******************************************************************************
TODO:
- Throw runtime errors everywhere if interpretation errors occur.
    // the => any => entity1.object.length == 1 
    // the => all => entity1.object.length == 1 AND entity2.object.length == 1
    // the => the => entity1.object.lenght == 1 AND entity2.object.length == 1
    // any => the => entity2.object.length == 1
    // any => all => ???
    // any => any => 
    // all => the => 
    // all => any => 
    // all => all =>
*******************************************************************************/

/** DNF formula is the main interpretation result. */
type CommandSemantics = DNFFormula

/** Semantics of an object is a collection of objects that match the description. */
type ObjectSemantics = string[]

/** Semantics of Entity is a wrapper around semantics of its children. */
type EntitySemantics = {quantifier : string; object : ObjectSemantics}

/** Semantics of Location is a wrapper around semantics of its children. */
type LocationSemantics = {relation : string; entity : EntitySemantics}

/** The core interpretation class. */
class Interpreter {
    constructor(
        private world : WorldState
    ) {}

    /** Returns error message if a physical law is violated, null otherwise */
    checkPhysicalLaw(rel : string, obj1 : string, obj2 : string) : string | null {

        // Returns true if str is a member of the specified array.
        function memberOf(str : string, arr : string[]) : boolean {
            return arr.indexOf(str) > -1;
        }
        // Find the actual objects in the world.
        var x : SimpleObject = this.world.objects.obj1;
        var y : SimpleObject = this.world.objects.obj2;

        // Test physical laws relating to the floor.
        if(x.form == "floor")
            return "I cannot take the floor";
        if(y.form == "floor" && memberOf(rel, ["under","leftof","rightof","beside","inside"]))
            return `Nothing can be $(rel) the floor.`;

        // The command must refer to 2 distinct objects in the world.
        if(obj1 == obj2) return `Nothing can be $(rel) of itself`;

        // #################################################################################################
        // Size = small, large
        // Form = anyform, brick, plank, ball, pyramid, box, table, floor
        // Rela = support(ontop, under, above, inside), leftof, rightof, beside
        // #################################################################################################
        
        // A ball can only be on top the floor.
        if(x.form == "ball" && rel == "ontop" && y.form != "floor")
            return `A ball can only be ontop the floor`;
        
        // A ball cannot support anything.
        if(x.form == "ball" && rel == "under")
            return `A ball cannot be under anything`;
        if(y.form == "ball" && memberOf(rel, ["inside","ontop","above"]))
            return `Nothing can be $(rel) a ball`;

        // Boxes cannot contain pyramids, planks or boxes of the same size.
        if(rel == "inside" && y.form == "box") {
            if(memberOf(x.form, ["pyramid","plank","box"]) && x.size == y.size)
                return `A $(x.form) cannot be inside a box of the same size`;
        }
        if(x.form == "box" && rel == "ontop" && memberOf(y.form, ["pyramid","brick"]))
            // Small boxes cannot be supported by small bricks or pyramids.
            if(x.size == "small" && y.size == "small")
                return `A small box cannot be ontop a small $(y.form)`;
            // Large boxes cannot be supported by large pyramids.
            if(x.size == "large" && y.size == "large" && y.form == "pyramid")
                return `A large box cannot be ontop a large pyramid`;

        // Objects are "inside" boxes, but "ontop" of other objects
        if(rel == "inside" && y.form != "box")
            return `Nothing can be inside a $(y.form)`;
        if(rel == "ontop" && y.form == "box")
            return `Nothing can be on top of a box`;

        // Small objects cannot support large objects. 
        if(memberOf(rel, ["inside","ontop"]) && x.size == "large" && y.size == "small")
            return `A large object cannot be $(rel) a small one`;
        
        return null;
    }

    interpretMove(cmd : MoveCommand) : CommandSemantics {
        var conjunctions : Conjunction[] = [];
        var location : LocationSemantics = this.interpretLocation(cmd.location);
        var ent1 : EntitySemantics = this.interpretEntity(cmd.entity);
        var ent2 : EntitySemantics = location.entity;
        var relation : string = location.relation;

        if(ent1.object.length == 0)
            throw "Couldn't find any matching object";
        if(ent2.object.length == 0)
            throw "Couldn't find any matching destination";

        // "any" interpretation for quantifiers
        for(var obj1 of ent1.object) {
            for(var obj2 of ent2.object) {
                var x : SimpleObject = this.world.objects.obj1;
                var y : SimpleObject = this.world.objects.obj2;




                conjunctions.push(new Conjunction([
                    new Literal(relation, [obj1, obj2])
                ]));

            }
        }


        // DNFFormula([conjunction1, conjunction2, ... ])
        // Conunction([literal1, literal2, ...])
        // Literal(relation, object => from objectsemantics)
        // entity = {"all", "the", "any"; [list of objects matched]}
        // location  = {relation, entity}
        // relation => "leftof", "rightof", "inside", "ontop", "under", "beside", "above"
        return new DNFFormula(conjunctions);
    }
    public interpretCommand(cmd : Command) : CommandSemantics {
        var interpretation : CommandSemantics;
        var all_objects : string[] = Array.prototype.concat.apply([], this.world.stacks);
        if (this.world.holding) {
            all_objects.push(this.world.holding);
        }
        if (cmd instanceof MoveCommand) {
            var a = all_objects[Math.floor(Math.random() * all_objects.length)];
            var b = all_objects[Math.floor(Math.random() * all_objects.length)];
            if (a == b) {
                throw "Cannot put an object ontop of itself";
            }
            interpretation = new DNFFormula([
                new Conjunction([ // ontop(a, b) & ontop(b, floor)
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

    interpretEntity(ent : Entity) : EntitySemantics {
        var obj : ObjectSemantics = this.interpretObject(ent.object);
        return { "quantifier" : ent.quantifier, "object" : obj };
    }

    interpretLocation(loc : Location) : LocationSemantics {
        var ent : EntitySemantics = this.interpretEntity(loc.entity);
        return { "relation" : loc.relation, "entity" : ent };
    }
    
    interpretObject(obj : Object) : ObjectSemantics {
        throw "Not implemented";
    }

    interpretTake(cmd : TakeCommand) : CommandSemantics {
        throw "Not yet implemented";
    }
    interpretDrop(cmd : DropCommand) : CommandSemantics {
        throw "Not yet implemented";
    }

}

