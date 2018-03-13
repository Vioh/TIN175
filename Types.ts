
/********************************************************************************
** Types

This module contains type and class declarations for parse results and interpretations.

You don't have to edit this file (unless you add things to the grammar).
********************************************************************************/


export class ShrdliteResult {
    constructor(
        public input : string,
        public parse : Command,
        public interpretation : DNFFormula,
        public plan : string[],
    ) {}
}


//////////////////////////////////////////////////////////////////////
// Parse results

export type Command =
      TakeCommand
    | DropCommand
    | MoveCommand
/*
// Here's an example of a new command
// Don't forget to add a class definition below
// The corresponding grammar rule(s) must also be added to Grammar.ne
    | WhereisCommand
*/
;

export class TakeCommand {
    constructor(public entity : Entity) {}
    toString() : string {return `TakeCommand(${this.entity.toString()})`};
    clone() : TakeCommand {return new TakeCommand(this.entity.clone())};
}

export class DropCommand {
    constructor(public location : Location) {}
    toString() : string {return `DropCommand(${this.location.toString()})`};
    clone() : DropCommand {return new DropCommand(this.location.clone())};
}

export class MoveCommand {
    constructor(public entity : Entity,
                public location : Location) {}
    toString() : string {return `MoveCommand(${this.entity.toString()}, ${this.location.toString()})`};
    clone() : MoveCommand {return new MoveCommand(this.entity.clone(), this.location.clone())};
}

/*
// Here's an example of a class definition for a new command
// Don't forget to add it to the type definition of 'Command' above
// The corresponding grammar rule(s) must also be added to Grammar.ne 
export class WhereisCommand {
    constructor(public entity : Entity) {}
    toString() : string {return `WhereisCommand(${this.entity.toString()})`};
    clone() : WhereisCommand {return new WhereisCommand(this.entity.clone())};
}
*/


export class Location {
    constructor(public relation : string,
                public entity : Entity) {}
    toString() : string {return `Location(${this.relation}, ${this.entity.toString()})`}
    clone() : Location {return new Location(this.relation, this.entity.clone())};
}


export class Entity {
    constructor(public quantifier : string,
                public object : Object) {}
    toString() : string {return `Entity(${this.quantifier}, ${this.object.toString()})`};
    clone() : Entity {return new Entity(this.quantifier, this.object.clone())};
}


export type Object = RelativeObject | SimpleObject | ComplexObject;

export class ComplexObject {
    constructor(public object1: Object,
        public object2: Object,
        public operator: string,) { }
    toString(): string { return `ComplexObject(${this.object1.toString()}, ${this.object2}, ${this.operator.toString()})` };
    clone(): ComplexObject { return new ComplexObject(this.object1.clone(), this.object2, this.operator) };
}

export class RelativeObject {
    constructor(public object : Object,
                public location : Location) {}
    toString() : string {return `RelativeObject(${this.object.toString()}, ${this.location.toString()})`};
    clone() : RelativeObject {return new RelativeObject(this.object.clone(), this.location.clone())};
}

export class SimpleObject {
    constructor(public form : Form,
                public size : Size | null,
                public color : Color | null) {}
    toString() : string {return `SimpleObject(${this.form}, ${this.size}, ${this.color})`};
    clone() : SimpleObject {return new SimpleObject(this.form, this.size, this.color)};
}

export type Size = "small" | "large";
export type Color = "red" | "black" | "blue" | "green" | "yellow" | "white";
export type Form = "anyform" | "brick" | "plank" | "ball" | "pyramid" | "box" | "table" | "floor";


//////////////////////////////////////////////////////////////////////
// Interpretations

export class DNFFormula {
    constructor(public conjuncts : Conjunction[] = []) {}
    toString() : string {return this.conjuncts.map((conj) => conj.toString()).join(" | ")};
}

export class Conjunction {
    constructor(public literals : Literal[] = []) {}
    toString() : string {return this.literals.map((lit) => lit.toString()).join(" & ")};
}

// A Literal represents a relation that is intended to hold among some objects.
export class Literal {
    constructor(
        public relation : string,         // The name of the relation in question
        public args : string[],           // The arguments to the relation
        public polarity : boolean = true, // Whether the literal is positive (true) or negative (false)
    ) {}
    toString() : string {return (this.polarity ? "" : "-") + this.relation + "(" + this.args.join(",") + ")"};
}
