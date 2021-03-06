import { ICustomNode } from '../interfaces/custom-nodes/ICustomNode';
import { INodeObfuscator } from '../interfaces/INodeObfuscator';
import { INode } from "../interfaces/nodes/INode";
import { IOptions } from "../interfaces/IOptions";

import { TUnicodeArrayCallsWrapper } from "../types/custom-nodes/TUnicodeArrayCallsWrapper";
import { TUnicodeArrayNode } from "../types/custom-nodes/TUnicodeArrayNode";

import { JSFuck } from "../enums/JSFuck";

import { Nodes } from "../Nodes";
import { Utils } from '../Utils';

export abstract class NodeObfuscator implements INodeObfuscator {
    /**
     * @type Map <string, Node>
     */
    protected nodes: Map <string, ICustomNode>;

    /**
     * @type {IOptions}
     */
    protected options: IOptions;

    /**
     * @param nodes
     * @param options
     */
    constructor(nodes: Map <string, ICustomNode>, options: IOptions) {
        this.nodes = nodes;
        this.options = options;
    }

    /**
     * @param node
     * @param parentNode
     */
    public abstract obfuscateNode (node: INode, parentNode?: INode): void;

    /**
     * @param name
     * @returns {boolean}
     */
    protected isReservedName (name: string): boolean {
        return this.options.reservedNames
            .some((reservedName: string) => {
                return new RegExp(reservedName, 'g').test(name);
            });
    }

    /**
     * Store all identifiers names as keys in given `namesMap` with random names as value.
     * Reserved names will be ignored.
     *
     * @param node
     * @param namesMap
     */
    protected storeIdentifiersNames (
        node: INode,
        namesMap: Map <string, string>
    ): void {
        if (Nodes.isIdentifierNode(node) && !this.isReservedName(node.name)) {
            namesMap.set(node.name, Utils.getRandomVariableName());
        }
    }

    /**
     * @param node
     * @param parentNode
     * @param namesMap
     */
    protected replaceIdentifiersWithRandomNames (
        node: INode,
        parentNode: INode,
        namesMap: Map <string, string>
    ): void {
        if (Nodes.isIdentifierNode(node) && namesMap.has(node.name)) {
            const parentNodeIsPropertyNode: boolean = (
                    Nodes.isPropertyNode(parentNode) &&
                    parentNode.key === node
                ),
                parentNodeIsMemberExpressionNode: boolean = (
                    Nodes.isMemberExpressionNode(parentNode) &&
                    parentNode.computed === false &&
                    parentNode.property === node
                );

            if (parentNodeIsPropertyNode || parentNodeIsMemberExpressionNode) {
                return;
            }

            node.name = <string>namesMap.get(node.name);
        }
    }

    /**
     * @param nodeValue
     * @returns {string}
     */
    protected replaceLiteralBooleanWithJSFuck (nodeValue: boolean): string {
        return nodeValue ? JSFuck.True : JSFuck.False;
    }

    /**
     * @param nodeValue
     * @returns {string}
     */
    protected replaceLiteralNumberWithHexadecimalValue (nodeValue: number): string {
        const prefix: string = '0x';

        if (!Utils.isInteger(nodeValue)) {
            return String(nodeValue);
        }

        return `${prefix}${Utils.decToHex(nodeValue)}`;
    }

    /**
     * @param nodeValue
     * @returns {string}
     */
    protected replaceLiteralValueWithUnicodeValue (nodeValue: string): string {
        let replaceWithUnicodeArrayFlag: boolean = Math.random() <= this.options.unicodeArrayThreshold;

        if (this.options.encodeUnicodeLiterals && replaceWithUnicodeArrayFlag) {
            nodeValue = Utils.btoa(nodeValue);
        }

        nodeValue = Utils.stringToUnicode(nodeValue);

        if (this.options.unicodeArray && replaceWithUnicodeArrayFlag) {
            return this.replaceLiteralValueWithUnicodeArrayCall(nodeValue);
        }

        return nodeValue;
    }

    /**
     * @param value
     * @returns {string}
     */
    protected replaceLiteralValueWithUnicodeArrayCall (value: string): string {
        let unicodeArrayNode: TUnicodeArrayNode = <TUnicodeArrayNode>this.nodes.get('unicodeArrayNode');

        if (!unicodeArrayNode) {
            throw new ReferenceError('`unicodeArrayNode` node is not found in Map with custom nodes.');
        }

        let unicodeArray: string[] = unicodeArrayNode.getNodeData(),
            valueIndex: number = unicodeArray.indexOf(value),
            literalValueCallIndex: number,
            hexadecimalIndex: string;

        if (valueIndex >= 0) {
            literalValueCallIndex = valueIndex;
        } else {
            literalValueCallIndex = unicodeArray.length;
            unicodeArrayNode.updateNodeData(value);
        }

        hexadecimalIndex = this.replaceLiteralNumberWithHexadecimalValue(literalValueCallIndex);

        if (this.options.wrapUnicodeArrayCalls) {
            let unicodeArrayCallsWrapper: TUnicodeArrayCallsWrapper = <TUnicodeArrayCallsWrapper>this.nodes.get('unicodeArrayCallsWrapper');

            if (!unicodeArrayCallsWrapper) {
                throw new ReferenceError('`unicodeArrayCallsWrapper` node is not found in Map with custom nodes.');
            }

            return `${unicodeArrayCallsWrapper.getNodeIdentifier()}('${hexadecimalIndex}')`;
        }

        return `${unicodeArrayNode.getNodeIdentifier()}[${hexadecimalIndex}]`;
    }
}
