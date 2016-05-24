/// <reference path="../../typings/tsd.d.ts" />

import ItalianGreeter from "./italiangreeter";

describe("ItalianGreeter", () => {

    describe("greet", () => {

        it("returns Hello World", () => {

            // Arrange
            let greeter = new ItalianGreeter("World");

            // Act
            let result = greeter.greet();

            // Assert
            expect(result).toEqual("Ciao World!!");
        });
    });
});
