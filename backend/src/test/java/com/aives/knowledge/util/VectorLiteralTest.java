package com.aives.knowledge.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class VectorLiteralTest {

    @Test
    void formatsPgvectorInputWithDots() {
        assertEquals("[0.50000000,-1.25000000]", VectorLiteral.format(new float[] {0.5f, -1.25f}));
    }
}
