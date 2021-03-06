import events       from './../helpers/Events.js';
import utility      from './../helpers/Utility.js';
import logger       from './../helpers/Logger.js';
import cacheFactory from './../helpers/CacheFactory.js';
import selectors    from './../helpers/Selectors.js';
import {StateManager, State} from './StateManager.js';

/**
 * @module Maple
 * @submodule CustomElement
 * @extends StateManager
 * @author Adam Timberlake
 * @link https://github.com/Wildhoney/Maple.js
 */
export default class CustomElement extends StateManager {

    /**
     * @constructor
     * @param {String} path
     * @param {HTMLScriptElement} scriptElement
     * @param {HTMLTemplateElement} templateElement
     * @param {String} importScript
     * @return {Element}
     */
    constructor(path, templateElement, scriptElement, importScript) {

        super();
        this.path     = path;
        this.sass     = (typeof Sass === 'undefined') ? null : new Sass();
        this.elements = { script: scriptElement, template: templateElement };
        this.script   = importScript;

        let descriptor = this.getDescriptor();

        if (!descriptor.extend) {

            return void utility.tryRegisterElement(descriptor.name, {
                prototype: this.getElementPrototype()
            });

        }

        let prototype = `HTML${descriptor.extend}Element`;

        utility.tryRegisterElement(descriptor.name, {
            prototype: this.getElementPrototype(window[prototype].prototype),
            extends: descriptor.extend.toLowerCase()
        });

    }

    /**
     * Responsible for loading associated styles into either the shadow DOM, if the path is determined to be local
     * to the component, or globally if not.
     *
     * @method loadStyles
     * @param {ShadowRoot} shadowBoundary
     * @return {Promise[]}
     */
    loadStyles(shadowBoundary) {

        /**
         * @method addCSS
         * @param {String} body
         * @return {void}
         */
        function addCSS(body) {
            let styleElement = document.createElement('style');
            styleElement.setAttribute('type', 'text/css');
            styleElement.innerHTML = body;
            shadowBoundary.appendChild(styleElement);
        }

        this.setState(State.RESOLVING);

        let content       = this.elements.template.content;
        let linkElements  = selectors.getCSSLinks(content);
        let styleElements = selectors.getCSSInlines(content);
        let promises      = [].concat(linkElements, styleElements).map((element) => new Promise((resolve) => {

            if (element.nodeName.toLowerCase() === 'style') {
                addCSS(element.innerHTML);
                resolve(element.innerHTML);
                return;
            }

            cacheFactory.fetch(this.path.getPath(element.getAttribute('href'))).then((body) => {

                if (element.getAttribute('type') === 'text/scss') {

                    if (!this.sass) {
                        logger.error('You should include "sass.js" for development runtime SASS compilation');
                        return void reject();
                    }

                    logger.warn('All of your SASS documents should be compiled to CSS for production via your build process');

                    // Compile SCSS document into CSS prior to appending it to the body.
                    return void this.sass.compile(body, (response) => {
                        addCSS(response.text);
                        resolve(response.text);
                    });

                }

                addCSS(body);
                resolve(body);

            });

        }));

        Promise.all(promises).then(() => this.setState(State.RESOLVED));
        return promises;

    }

    /**
     * Extract the element name, and optionally the element extension, from converting the Function to a String via
     * the `toString` method. It's worth noting that this is probably the weakest part of the Maple system because it
     * relies on a regular expression to determine the name of the resulting custom HTML element.
     *
     * @method getDescriptor
     * @return {Object}
     */
    getDescriptor() {

        // With ES6 the `Function.prototype.name` property is beginning to be standardised, which means
        // in many cases we won't have to resort to the feeble `toString` approach. Hoorah!
        let name   = this.script.name || this.script.toString().match(/(?:function|class)\s*([a-z_]+)/i)[1],
            extend = null;

        if (~name.indexOf('_')) {

            // Does the element name reference an element to extend?
            let split = name.split('_');
            name      = split[0];
            extend    = split[1];

        }

        return { name: utility.toSnakeCase(name), extend: extend };

    }

    /**
     * Yields the prototype for the custom HTML element that will be registered for our custom React component.
     * It listens for when the custom element has been inserted into the DOM, and then sets up the styles, applies
     * default React properties, etc...
     *
     * @method getElementPrototype
     * @param {Object} elementPrototype
     * @return {Object}
     */
    getElementPrototype(elementPrototype) {

        let loadStyles = this.loadStyles.bind(this),
            script    = this.script,
            path      = this.path;

        return Object.create(elementPrototype || HTMLElement.prototype, {

            /**
             * @property attachedCallback
             * @type {Object}
             */
            attachedCallback: {

                /**
                 * @method value
                 * @return {void}
                 */
                value: function value() {

                    /**
                     * @method setDefaultProps
                     * @param {Object} attributes
                     * @return {void}
                     */
                    function setDefaultProps(attributes) {

                        attributes   = Array.prototype.slice.apply(attributes);
                        let replacer = /^data-/i;

                        attributes.forEach((attribute) => {

                            if (attribute.name === utility.ATTRIBUTE_REACTID) {
                                return;
                            }

                            // Typecast the value depending on the type.
                            let name  = attribute.name.replace(replacer, '');
                            script.defaultProps[name] = utility.typecastProperty(attribute.value);

                        });

                    }

                    // Apply properties to the custom element.
                    script.defaultProps = { path: path, element: this.cloneNode(true) };
                    setDefaultProps.call(this, this.attributes);
                    this.innerHTML      = '';

                    // Configure the React.js component, importing it under the shadow boundary.
                    let renderedElement = React.createElement(script),
                        contentElement  = document.createElement('content'),
                        shadowRoot      = this.createShadowRoot();

                    shadowRoot.appendChild(contentElement);
                    let component = React.render(renderedElement, contentElement);

                    // Configure the event delegation for the component.
                    events.registerComponent(component);

                    /**
                     * Import external CSS documents and resolve element.
                     *
                     * @method resolveElement
                     * @return {void}
                     */
                    function resolveElement() {

                        Promise.all(loadStyles(shadowRoot)).then(() => {
                            this.removeAttribute('unresolved');
                            this.setAttribute('resolved', '');
                        });

                    }

                    resolveElement.apply(this);

                }

            }

        });

    }

}