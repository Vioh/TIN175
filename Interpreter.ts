
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

/** The core interpretation class. */
class Interpreter {
    constructor(
        private world : WorldState
    ) {}

    /** Returns an interpretation (DNF formula) of a command. */
    public interpretCommand(cmd : Command) : CommandSemantics {
        if(cmd instanceof MoveCommand) return this.interpretMove(cmd);
        if(cmd instanceof TakeCommand) return this.interpretTake(cmd);
        if(cmd instanceof DropCommand) return this.interpretDrop(cmd);
        throw "Unknown command";
    }

    /** Returns an interpretation for the move command. */
    interpretMove(cmd : MoveCommand) : CommandSemantics {
        let errors : string[] = [];
        let conjunctions : Conjunction[] = [];
        
        // Interpret the components of the MoveCommand.
        let location : LocationSemantics = this.interpretLocation(cmd.location);
        let ent1 : EntitySemantics = this.interpretEntity(cmd.entity);
        let ent2 : EntitySemantics = location.entity;

        // Pre-processing and throw errors if necessary. 
        if(ent1.object.length == 0) throw `Couldn't find any matching object`;
        if(ent2.object.length == 0) throw `Couldn't find any matching destination`;

        // Interpret using the semantics of the "any" quantifier.
        for(let x of ent1.object) {
            for(let y of ent2.object) {
                let error = this.validate(x, y, location.relation).error;
                if(error) // physical law violation
                    errors.push(error);
                else conjunctions.push(new Conjunction([
                    new Literal(location.relation, [x, y])
                ]));
        }}
        // TODO: is it necessary to merge all errors?
        if(conjunctions.length == 0)
            throw errors.join(" ; "); // merge all errors into one
        else return new DNFFormula(conjunctions);
    }
    
    /** Returns an interpretation for the take command. */
    interpretTake(cmd : TakeCommand) : CommandSemantics {
        let ent : EntitySemantics = this.interpretEntity(cmd.entity);

        // Error handlings for all the quantifiers.
        if(ent.object.length == 0) throw `Couldn't find any matching object`;
        if(ent.object.length != 1) {
            if(ent.quantifier == "the") throw `Found too many matching objects`;
            if(ent.quantifier == "all") throw `I cannot take more than one object`;
        }
        // Create conjunctions for the interpreting.
        let conjunctions : Conjunction[] = [];
        for(let x of ent.object)
            conjunctions.push(new Conjunction([
                new Literal("holding", [x])
            ]));
        return new DNFFormula(conjunctions);
    }

    /** Returns an interpretation for the drop command. */
    interpretDrop(cmd : DropCommand) : CommandSemantics {
        let errors : string[] = [];
        let conjunctions : Conjunction[] = [];
        let location : LocationSemantics = this.interpretLocation(cmd.location);
        let ent : EntitySemantics = location.entity;

        // Intial error handlings.
        if(!this.world.holding)
            throw `I'm not holding anything`;
        if(ent.object.length == 0) 
            throw `Couldn't find any matching destination`;

        // Interpret using the semantics of the "any" quantifier.
        for(let x of ent.object) {
            let error = this.validate(this.world.holding, x, location.relation).error;
            if(error) // physical law violation
                errors.push(error);
            else conjunctions.push(new Conjunction([
                new Literal(location.relation, [this.world.holding, x])
            ]));
        }
        // TODO: is it necessary to merge all errors?
        if(conjunctions.length == 0)
            throw errors.join(" ; "); // merge all errors into one
        else return new DNFFormula(conjunctions);
    }

    /** Validate and returns an error message if a physical law is violated.  */
    validate(obj1 : string, obj2 : string, rel : string) : {error?: string} {

        // Returns true if str is a member of the specified array.
        function memberOf(str : string, arr : string[]) : boolean {
            return arr.indexOf(str) > -1;
        }
        // Find the actual objects in the world.
        let x : SimpleObject = this.world.objects.obj1;
        let y : SimpleObject = this.world.objects.obj2;

        // Test physical laws relating to the floor.
        if(x.form == "floor")
            return {error: "I cannot take the floor"};
        if(y.form == "floor" && memberOf(rel, ["under","leftof","rightof","beside","inside"]))
            return {error: `Nothing can be $(rel) the floor.`};

        // The command must refer to 2 distinct objects in the world.
        if(obj1 == obj2) return {error: `Nothing can be $(rel) itself`};

        // A ball can be on top of ONLY the floor (otherwise they roll away).
        if(x.form == "ball" && y.form != "floor" && rel == "ontop")
            return {error: `A ball can only be ontop the floor`};

        // A ball cannot support anything.
        if(x.form == "ball" && rel == "under")
            return {error: `A ball cannot be under anything`};
        if(y.form == "ball" && memberOf(rel, ["ontop","above"]))
            return {error: `Nothing can be $(rel) a ball`};

        // Objects are "inside" boxes, but "ontop" of other objects
        if(y.form != "box" && rel == "inside")
            return {error: `Nothing can be inside a $(y.form)`};
        if(y.form == "box" && rel == "ontop")
            return {error: `Nothing can be ontop a box`};

        // Boxes cannot contain pyramids, planks or boxes of the same size.
        if(memberOf(x.form, ["pyramid","plank","box"]) && y.form == "box" && rel == "inside")
            if(x.size == y.size) return {error: `A $(x.form) cannot be inside a box of the same size`};

        if(x.form == "box" && memberOf(y.form, ["pyramid","brick"]) && rel == "ontop")
            // Small boxes cannot be supported by small bricks or pyramids.
            if(x.size == "small" && y.size == "small")
                return {error: `A small box cannot be ontop a small $(y.form)`};
            // Large boxes cannot be supported by large pyramids.
            if(x.size == "large" && y.size == "large" && y.form == "pyramid")
                return {error: `A large box cannot be ontop a large pyramid`};

        // Small objects cannot support large objects. 
        if(memberOf(rel, ["inside","ontop"]) && x.size == "large" && y.size == "small")
            return {error: `A large object cannot be $(rel) a small one`};

        return {error: undefined}; // Reaching here means that no physical law is violated.
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
    
    interpretObject(obj : Object) : ObjectSemantics {
        throw "Not implemented";
        // var all_objects : string[] = Array.prototype.concat.apply([], this.world.stacks);
        // if (this.world.holding) {
        //     all_objects.push(this.world.holding);
        // }
    }
}

/*******************************************************************************
TODO:
- Throw runtime errors everywhere if interpretation errors occur.
    // the => any => entity1.object.length == 1 
    // the => all => entity1.object.length == 1 AND entity2.object.length == 1
    // the => the => entity1.object.lenght == 1 AND entity2.object.length == 1
    // any => the => entity2.object.length == 1
    // any => all => ???
    // any => any => ??? 
    // all => the => ???
    // all => any => ???
    // all => all => ???
    // #################################################################################################
    // Relation = support(ontop, under, above, inside), leftof, rightof, beside
    // #################################################################################################
*******************************************************************************/