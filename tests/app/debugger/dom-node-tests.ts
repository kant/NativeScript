import { assert, assertEqual } from "../TKUnit";
import { DOMNode } from "tns-core-modules/debugger/dom-node";
import { attachInspectorCallbacks } from "tns-core-modules/debugger/devtools-elements";
import { Inspector } from "tns-core-modules/debugger/devtools-elements";
import { unsetValue } from "tns-core-modules/ui/core/properties";
import { Button } from "tns-core-modules/ui/button";
import { Slider } from "tns-core-modules/ui/slider";
import { Label } from "tns-core-modules/ui/label";
import { textProperty } from "tns-core-modules/ui/text-base";
import { TextView } from "tns-core-modules/ui/text-view";
import { StackLayout } from "tns-core-modules/ui/layouts/stack-layout";

let originalInspectorGlobal: Inspector;
let currentInspector: Inspector;
function getTestInspector(): Inspector {
    let inspector = {
        getDocument(): string { return ""; },
        removeNode(nodeId: number): void { /* */ },
        getComputedStylesForNode(nodeId: number): string { return ""; },
        setAttributeAsText(nodeId: number, text: string, name: string): void { /* */},

        childNodeInserted(parentId: number, lastId: number, nodeStr: string): void { /* to be replaced */ },
        childNodeRemoved(parentId: number, nodeId: number): void { /* to be replaced */ },
        attributeModified(nodeId: number, attrName: string, attrValue: string) { /* to be replaced */ },
        attributeRemoved(nodeId: number, attrName: string) { /* to be replaced */ }
    }

    attachInspectorCallbacks(inspector);

    return inspector;
}

export function setUp(): void {
    originalInspectorGlobal = global.__inspector;
    currentInspector = getTestInspector();
    global.__inspector = currentInspector;
}

export function tearDown(): void {
    global.__inspector = originalInspectorGlobal;
}

function assertAttribute(domNode: DOMNode, name: string, value: any) {
    const propIdx = domNode.attributes.indexOf(name);
    assert(propIdx >= 0, `Attribute ${name} not found`);
    assertEqual(domNode.attributes[propIdx + 1], value);
}

export function test_custom_attribute_is_reported_in_dom_node() {
    const btn = new Button();
    btn["test_prop"] = "test_value";
    btn.ensureDomNode();
    const domNode = btn.domNode;
    assertAttribute(domNode, "test_prop", "test_value");
}

export function test_custom__falsy_attribute_is_reported_in_dom_node() {
    const btn = new Button();
    btn["test_prop_null"] = null;
    btn["test_prop_0"] = 0;
    btn["test_prop_undefined"] = undefined;
    btn["test_prop_empty_string"] = "";

    btn.ensureDomNode();
    const domNode = btn.domNode;
    assertAttribute(domNode, "test_prop_null", null + "");
    assertAttribute(domNode, "test_prop_0", 0 + "");
    assertAttribute(domNode, "test_prop_undefined", undefined + "");
    assertAttribute(domNode, "test_prop_empty_string", "");
}

export function test_property_is_reported_in_dom_node() {
    const btn = new Button();
    btn.text = "test_value";
    btn.ensureDomNode();
    const domNode = btn.domNode;
    assertAttribute(domNode, "text", "test_value");
}

export function test_childNodeInserted_in_dom_node() {
    let childNodeInsertedCalled = false;
    let actualParentId = 0;
    let expectedParentId = 0;

    currentInspector.childNodeInserted = (parentId, lastNodeId, node) => {
        childNodeInsertedCalled = true;
        actualParentId = parentId;
    }

    const stack = new StackLayout();
    stack.ensureDomNode();
    expectedParentId = stack._domId;

    const btn1 = new Button();
    btn1.text = "button1";
    stack.addChild(btn1);

    assert(childNodeInsertedCalled, "global.__inspector.childNodeInserted not called.");
    assertEqual(actualParentId, expectedParentId);
}

export function test_childNodeInserted_at_index_in_dom_node() {
    const stack = new StackLayout();
    stack.ensureDomNode();

    // child index 0
    const btn1 = new Button();
    btn1.text = "button1";
    stack.addChild(btn1);

    // child index 1
    const btn2 = new Button();
    btn2.text = "button2";
    stack.addChild(btn2);

    // child index 2
    const btn3 = new Button();
    btn3.text = "button3";
    stack.addChild(btn3);

    const lbl = new Label();
    lbl.text = "label me this";

    let called = false;
    currentInspector.childNodeInserted = (parentId, lastNodeId, node) => {
        assertEqual(lastNodeId, btn1._domId, "Child inserted at index 1's previous sibling does not match.");
        assertEqual(JSON.parse(node).nodeId, lbl._domId, "Child id doesn't match");
        called = true;
    }

    stack.insertChild(lbl, 1);
    assert(called, "childNodeInserted not called");
}

export function test_childNodeRemoved_in_dom_node() {
    let childNodeRemovedCalled = false;
    let actualRemovedNodeId = 0;
    let expectedRemovedNodeId = 0;

    currentInspector.childNodeRemoved = (parentId, nodeId) => {
        childNodeRemovedCalled = true;
        actualRemovedNodeId = nodeId;
    }

    const stack = new StackLayout();
    stack.ensureDomNode();

    const btn1 = new Button();
    btn1.text = "button1";
    expectedRemovedNodeId = btn1._domId;
    stack.addChild(btn1);

    const btn2 = new Button();
    btn2.text = "button2";
    stack.addChild(btn2);

    stack.removeChild(btn1);
    console.log("btn2: " + btn2);

    assert(childNodeRemovedCalled, "global.__inspector.childNodeRemoved not called.");
    assertEqual(actualRemovedNodeId, expectedRemovedNodeId);
}

export function test_falsy_property_is_reported_in_dom_node() {
    const btn = new Button();
    btn.text = null;
    btn.ensureDomNode();
    const domNode = btn.domNode;
    assertAttribute(domNode, "text", "null");

    btn.text = undefined;
    domNode.loadAttributes();
    assertAttribute(domNode, "text", "undefined");
}

export function test_property_change_calls_attributeModified() {
    const btn = new Button();
    btn.ensureDomNode();
    const domNode = btn.domNode;

    let callbackCalled = false;
    currentInspector.attributeModified = (nodeId: number, attrName: string, attrValue: string) => {
        assertEqual(nodeId, domNode.nodeId, "nodeId");
        assertEqual(attrName, "text", "attrName");
        assertEqual(attrValue, "new value", "attrValue");
        callbackCalled = true;
    }

    btn.text = "new value";

    assert(callbackCalled, "attributeModified not called");
}

export function test_property_change_from_native_calls_attributeModified() {
    const tv = new TextView();
    tv.ensureDomNode();
    const domNode = tv.domNode;

    let callbackCalled = false;
    currentInspector.attributeModified = (nodeId: number, attrName: string, attrValue: string) => {
        assertEqual(nodeId, domNode.nodeId, "nodeId");
        assertEqual(attrName, "text", "attrName");
        assertEqual(attrValue, "new value", "attrValue");
        callbackCalled = true;
    }

    textProperty.nativeValueChange(tv, "new value");

    assert(callbackCalled, "attributeModified not called");
}

export function test_property_reset_calls_attributeRemoved() {
    const btn = new Button();
    btn.text = "some value";
    btn.ensureDomNode();
    const domNode = btn.domNode;

    let callbackCalled = false;
    currentInspector.attributeRemoved = (nodeId: number, attrName: string) => {
        assertEqual(nodeId, domNode.nodeId, "nodeId");
        assertEqual(attrName, "text", "attrName");
        callbackCalled = true;
    }

    btn.text = unsetValue;

    assert(callbackCalled, "attributeRemoved not called");
}

export function test_coercible_property_change_calls_attributeModified() {
    const slider = new Slider();
    slider.ensureDomNode();
    const domNode = slider.domNode;

    let callbackCalled = false;
    currentInspector.attributeModified = (nodeId: number, attrName: string, attrValue: string) => {
        assertEqual(nodeId, domNode.nodeId, "nodeId");
        assertEqual(attrName, "value", "attrName");
        assertEqual(attrValue, "10", "attrValue");
        callbackCalled = true;
    }

    slider.value = 10;

    assert(callbackCalled, "attributeModified not called");
}

export function test_coercible_property_reset_calls_attributeRemoved() {
    const slider = new Slider();
    slider.value = 10;
    slider.ensureDomNode();
    const domNode = slider.domNode;

    let callbackCalled = false;
    currentInspector.attributeRemoved = (nodeId: number, attrName: string) => {
        assertEqual(nodeId, domNode.nodeId, "nodeId");
        assertEqual(attrName, "value", "attrName");
        callbackCalled = true;
    }

    slider.value = unsetValue;

    assert(callbackCalled, "attributeRemoved not called");
}

export function test_inspector_ui_setAttributeAsText_set_existing_property() {
    // Arrange
    const label = new Label();

    label.text = "original label";
    const expectedValue = "updated label";

    label.ensureDomNode();

    // Act
    // simulate call from the inspector UI
    currentInspector.setAttributeAsText(label.domNode.nodeId, "text='" + expectedValue + "'", "text");

    // Assert
    assertEqual(label.text, expectedValue);
}

export function test_inspector_ui_setAttributeAsText_remove_existing_property() {
    // Arrange
    const label = new Label();
    label.text = "original label";

    label.ensureDomNode();

    // Act
    // simulate call from the inspector UI
    currentInspector.setAttributeAsText(label.domNode.nodeId, "" /* empty value - removes the attribute */, "text");

    // Assert
    assertEqual(label.text, "");
}

export function test_inspector_ui_setAttributeAsText_set_new_property() {
    // Arrange
    const label = new Label();
    const expectedValue = "custom";

    label.ensureDomNode();

    // Act
    // simulate call from the inspector UI
    currentInspector.setAttributeAsText(label.domNode.nodeId, "data-attr='" + expectedValue + "'" /* data-attr="custom" */, " " /* empty attr name initially */);

    // Assert
    assertEqual(label["data-attr"], expectedValue);
}

export function test_inspector_ui_removeNode() {
    let childNodeRemovedCalled = false;
    let stack = new StackLayout();
    let label = new Label();
    stack.addChild(label);

    stack.ensureDomNode();
    label.ensureDomNode();

    let expectedParentId = stack.domNode.nodeId;
    let expectedNodeId = label.domNode.nodeId;

    currentInspector.childNodeRemoved = (parentId, nodeId) => {
        childNodeRemovedCalled = true;
        assertEqual(parentId, expectedParentId);
        assertEqual(nodeId, expectedNodeId);
    }

    currentInspector.removeNode(label.domNode.nodeId);

    assert(childNodeRemovedCalled, "childNodeRemoved callback not called.");
}
