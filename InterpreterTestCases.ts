
/********************************************************************************
** InterpreterTestCases

This file contains several test cases, some of which have not been authored yet.
You should add your own interpretation where it says so.
You are also free to add new test cases.
********************************************************************************/

export interface TestCase {
    world : string;
    utterance : string;
    interpretations : string[]
}

export var testCases : TestCase[] = [];


//////////////////////////////////////////////////////////////////////
// Examples that test the physical laws

// "Balls must be in boxes or on the floor, otherwise they roll away"

testCases.push({
    world: "small",
    utterance: "put a ball on a table",
    interpretations: []
});

// "Objects are “inside” boxes, but “ontop” of other objects"

testCases.push({
    world: "small",
    utterance: "put a ball on a box",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "put a box in a brick",
    interpretations: []
});

// "Boxes cannot contain pyramids, planks or boxes of the same size"

testCases.push({
    world: "medium",
    utterance: "put a plank in a box",
    interpretations: ["inside(SmlGrnPlnk,LrgYlwBox) | inside(SmlGrnPlnk,LrgRedBox)"]
});

testCases.push({
    world: "medium",
    utterance: "put a large plank in a box",
    interpretations: []
});

testCases.push({
    world: "medium",
    utterance: "put a pyramid in a box",
    interpretations: ["inside(SmlRedPrmd,LrgYlwBox) | inside(SmlRedPrmd,LrgRedBox)"]
});

testCases.push({
    world: "medium",
    utterance: "put a pyramid in a small box",
    interpretations: []
});

testCases.push({
    world: "medium",
    utterance: "put a box in a box",
    interpretations: ["inside(SmlBluBox,LrgYlwBox) | inside(SmlBluBox,LrgRedBox)"]
});

testCases.push({
    world: "medium",
    utterance: "put a large box in a box",
    interpretations: []
});

testCases.push({
    world: "medium",
    utterance: "put a plank in a small box",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "put a big ball in a small box",
    interpretations: []
});

// "Small boxes cannot be supported by small bricks or pyramids."

testCases.push({
    world: "medium",
    utterance: "put a large box on a large brick",
    interpretations: ["ontop(LrgYlwBox,LrgGrnBrck1) | ontop(LrgYlwBox,LrgGrnBrck2) | " +
                      "ontop(LrgYlwBox,LrgGrnBrck3) | ontop(LrgRedBox,LrgGrnBrck1) |" +
                      "ontop(LrgRedBox,LrgGrnBrck2) | ontop(LrgRedBox,LrgGrnBrck3)"]
    });

testCases.push({
    world: "medium",
    utterance: "put a small box on a small brick",
    interpretations: []
});

testCases.push({
    world: "medium",
    utterance: "put a small box on a small pyramid",
    interpretations: []
});

// "Large boxes cannot be supported by large pyramids."

testCases.push({
    world: "medium",
    utterance: "put a large box on a large pyramid",
    interpretations: []
});

// Common errors with the floor

testCases.push({
    world: "small",
    utterance: "take the floor",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "put a brick on a floor",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "put a brick on the red floor",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "take a ball on a box",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "take a ball in the floor",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "take a box in a table",
    interpretations: []
});


//////////////////////////////////////////////////////////////////////
// Simple examples with a clear interpretation

testCases.push({
    world: "small",
    utterance: "take an object",
    interpretations: ["holding(LargeWhiteBall) | holding(SmallBlackBall) | holding(LargeBlueTable) |" +
                      "holding(LargeYellowBox) | holding(LargeRedBox) | holding(SmallBlueBox)"]
});

testCases.push({
    world: "small",
    utterance: "take a blue object",
    interpretations: ["holding(LargeBlueTable)  |  holding(SmallBlueBox)"]
});

testCases.push({
    world: "small",
    utterance: "take a box",
    interpretations: ["holding(LargeYellowBox) | holding(LargeRedBox) | holding(SmallBlueBox)"]
});

testCases.push({
    world: "small",
    utterance: "put a ball in a box",
    interpretations: ["inside(LargeWhiteBall,LargeYellowBox) | inside(LargeWhiteBall,LargeRedBox) |" +
                      "inside(SmallBlackBall,LargeYellowBox) | inside(SmallBlackBall,LargeRedBox) |" +
                      "inside(SmallBlackBall,SmallBlueBox)"]
});

testCases.push({
    world: "small",
    utterance: "put a ball above a table",
    interpretations: ["above(LargeWhiteBall,LargeBlueTable)|above(SmallBlackBall,LargeBlueTable)"]
});

testCases.push({
    world: "small",
    utterance: "put a ball left of a ball",
    interpretations: ["leftof(LargeWhiteBall,SmallBlackBall) | leftof(SmallBlackBall,LargeWhiteBall)"]
});

testCases.push({
    world: "small",
    utterance: "take a white object beside a blue object",
    interpretations: ["holding(LargeWhiteBall)"]
});

testCases.push({
    world: "small",
    utterance: "put a white object beside a blue object",
    interpretations: ["beside(LargeWhiteBall,LargeBlueTable) | beside(LargeWhiteBall,SmallBlueBox)"]
});

testCases.push({
    world: "small",
    utterance: "put a white ball in a box on the floor",
    interpretations: ["inside(LargeWhiteBall,LargeYellowBox)"]
});

testCases.push({
    world: "small",
    utterance: "put a black ball in a box on the floor",
    interpretations: ["inside(SmallBlackBall,LargeYellowBox)",
                      //// Perhaps you want the following interpretation too?
                      // "inside(SmallBlackBall,SmallBlueBox) & ontop(SmallBlueBox,floor)",
                      // "inside(SmallBlackBall,LargeRedBox) & ontop(LargeRedBox,floor)",
                      "ontop(SmallBlackBall,floor)"]
});


//////////////////////////////////////////////////////////////////////
// Examples where YOU shuold define the interpretation

testCases.push({
    world: "small",
    utterance: "put a ball in a box on the floor",
    interpretations: ["inside(LargeWhiteBall,LargeYellowBox) | inside(SmallBlackBall,LargeYellowBox)",
                      "ontop(SmallBlackBall,floor)"]
});

// "put it"

testCases.push({
    world: "medium",
    utterance: "put it on the floor",
    interpretations: ["ontop(LrgGrnBrck1,floor)"]
});

// Deep recursion

testCases.push({
    world: "small",
    utterance: "take a ball in a box in a box",
    interpretations: ["holding(SmallBlackBall)"]
});

testCases.push({
    world: "small",
    utterance: "take a ball in a box in a box on the floor",
    interpretations: ["holding(SmallBlackBall)"]
});

testCases.push({
    world: "small",
    utterance: "put a box on a table on the floor",
    interpretations: ["ontop(LargeRedBox,floor)",
                      "ontop(LargeYellowBox,LargeBlueTable) | ontop(LargeRedBox,LargeBlueTable) | ontop(SmallBlueBox,LargeBlueTable)"]
});

testCases.push({
    world: "small",
    utterance: "put a box in a box on a table",
    interpretations: ["inside(SmallBlueBox,LargeRedBox)",
                      "ontop(SmallBlueBox,LargeBlueTable)"]
});

testCases.push({
    world: "small",
    utterance: "put a box in a box on a table on the floor",
    interpretations: ["inside(SmallBlueBox,LargeRedBox)",
                      "ontop(SmallBlueBox,LargeBlueTable)"]
});

testCases.push({
    world: "medium",
    utterance: "put a brick on a brick on a brick on the floor",
    interpretations: ["ontop(SmlWhtBrck,LrgGrnBrck2)",
                      "ontop(SmlWhtBrck,floor)"]
});


//////////////////////////////////////////////////////////////////////
// Test cases for the ALL quantifier
// These are not necessary to solve if you only aim for grade 3/G

testCases.push({
    world: "small",
    utterance: "put all balls on the floor",
    interpretations: ["ontop(LargeWhiteBall,floor) & ontop(SmallBlackBall,floor)"]
});

testCases.push({
    world: "small",
    utterance: "put every ball to the right of all blue things",
    interpretations: ["rightof(LargeWhiteBall,LargeBlueTable) & rightof(LargeWhiteBall,SmallBlueBox) &" +
                      "rightof(SmallBlackBall,LargeBlueTable) & rightof(SmallBlackBall,SmallBlueBox)"]
});

testCases.push({
    world: "small",
    utterance: "put all balls left of a box on the floor",
    interpretations: ["COME-UP-WITH-YOUR-OWN-INTERPRETATION"]
});

testCases.push({
    world: "small",
    utterance: "put a ball in every large box",
    interpretations: []
});

testCases.push({
    world: "small",
    utterance: "put every ball in a box",
    interpretations: []
});

testCases.push({
    world: "medium",
    utterance: "put all large green bricks beside a large green brick",
    interpretations: ["beside(LrgGrnBrck2,LrgGrnBrck1) & beside(LrgGrnBrck3,LrgGrnBrck1) |" +
                      "beside(LrgGrnBrck1,LrgGrnBrck2) & beside(LrgGrnBrck3,LrgGrnBrck2) |" +
                      "beside(LrgGrnBrck1,LrgGrnBrck3) & beside(LrgGrnBrck2,LrgGrnBrck3)"]
});

testCases.push({
    world: "medium",
    utterance: "put all green objects left of all red objects",
    interpretations: ["leftof(LrgGrnBrck1,LrgRedPlnk) & leftof(LrgGrnBrck1,SmlRedTble) &" +
                      "leftof(LrgGrnBrck1,SmlRedPrmd) & leftof(LrgGrnBrck1,LrgRedBox) &" +
                      "leftof(LrgGrnBrck2,LrgRedPlnk) & leftof(LrgGrnBrck2,SmlRedTble) &" +
                      "leftof(LrgGrnBrck2,SmlRedPrmd) & leftof(LrgGrnBrck2,LrgRedBox) &" +
                      "leftof(LrgGrnBrck3,LrgRedPlnk) & leftof(LrgGrnBrck3,SmlRedTble) &" +
                      "leftof(LrgGrnBrck3,SmlRedPrmd) & leftof(LrgGrnBrck3,LrgRedBox) &" +
                      "leftof(SmlGrnPlnk,LrgRedPlnk) & leftof(SmlGrnPlnk,SmlRedTble) &" +
                      "leftof(SmlGrnPlnk,SmlRedPrmd) & leftof(SmlGrnPlnk,LrgRedBox)"]
});
