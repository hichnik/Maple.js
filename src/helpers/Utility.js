import logger  from './Logger.js';
import options from './Options.js';

export default (function main($document) {

    "use strict";

    return {

        /**
         * @constant ATTRIBUTE_REACTID
         * @type {String}
         */
        ATTRIBUTE_REACTID: 'data-reactid',

        /**
         * @method resolver
         * @param {String} url
         * @param {HTMLDocument|null} ownerDocument
         * @return {Object}
         */
        resolver(url, ownerDocument) {

            let componentPath = this.getPath(url),
                getPath       = this.getPath.bind(this),
                getName       = this.getName.bind(this);
            /**
             * @method resolvePath
             * @param {String} path
             * @param {HTMLDocument} overrideDocument
             * @return {String}
             */
            function resolvePath(path, overrideDocument = $document) {
                let a  = overrideDocument.createElement('a');
                a.href = path;
                return a.href;
            }

            return {

                /**
                 * @property production
                 * @type {Object}
                 */
                production: {

                    /**
                     * @method getPath
                     * @param {String} path
                     * @return {String}
                     */
                    getPath(path) {

                        if (this.isLocalPath(path)) {
                            return `${this.getAbsolutePath()}/${getName(path)}`;
                        }

                        return resolvePath(path, $document);

                    },

                    /**
                     * @method getSrc
                     * @return {String}
                     */
                    getSrc(src) {
                        return getName(src);
                    },

                    /**
                     * @method getAbsolutePath
                     * @return {String}
                     */
                    getAbsolutePath() {
                        return resolvePath(url);
                    },

                    /**
                     * @method getRelativePath
                     * @return {String}
                     */
                    getRelativePath() {
                        return url;
                    },

                    /**
                     * @method isLocalPath
                     * @param {String} path
                     * @return {Boolean}
                     */
                    isLocalPath(path) {
                        return !!~path.indexOf(url);
                    }

                },

                /**
                 * @property development
                 * @type {Object}
                 */
                development: {

                    /**
                     * @method getPath
                     * @param {String} path
                     * @return {String}
                     */
                    getPath(path) {

                        if (this.isLocalPath(path)) {
                            return `${this.getAbsolutePath()}/${path}`;
                        }

                        return resolvePath(path, $document);

                    },

                    /**
                     * @method getSrc
                     * @return {String}
                     */
                    getSrc(src) {
                        return src;
                    },

                    /**
                     * @method getAbsolutePath
                     * @return {String}
                     */
                    getAbsolutePath() {
                        return resolvePath(componentPath);
                    },

                    /**
                     * @method getRelativePath
                     * @return {String}
                     */
                    getRelativePath() {
                        return componentPath;
                    },

                    /**
                     * @method isLocalPath
                     * @param path {String}
                     * @return {Boolean}
                     */
                    isLocalPath(path) {
                        path = getPath(resolvePath(path, ownerDocument));
                        return !!~resolvePath(componentPath).indexOf(path);
                    }

                }

            }

        },

        /**
         * @method toArray
         * @param {*} arrayLike
         * @return {Array}
         */
        toArray(arrayLike) {
            return Array.from ? Array.from(arrayLike) : Array.prototype.slice.apply(arrayLike);
        },

        /**
         * @method flattenArray
         * @param {Array} arr
         * @param {Array} [givenArr=[]]
         */
        flattenArray(arr, givenArr = []) {

            /* jshint ignore:start */

            arr.forEach((item) => {
                (Array.isArray(item)) && (this.flattenArray(item, givenArr));
                (!Array.isArray(item)) && (givenArr.push(item));
            });

            /* jshint ignore:end */

            return givenArr;

        },

        /**
         * @method toSnakeCase
         * @param {String} camelCase
         * @param {String} [joiner='-']
         * @return {String}
         */
        toSnakeCase(camelCase, joiner = '-') {
            return camelCase.split(/([A-Z][a-z]{0,})/g).filter(parts => parts).join(joiner).toLowerCase();
        },

        /**
         * @method getName
         * @param {String} importPath
         * @return {String}
         */
        getName(importPath) {
            return importPath.split('/').slice(-1);
        },

        /**
         * @method getPath
         * @param {String} importPath
         * @return {String}
         */
        getPath(importPath) {
            return importPath.split('/').slice(0, -1).join('/');
        },

        /**
         * @method removeExtension
         * @param {String} filePath
         * @return {String}
         */
        removeExtension(filePath) {
            return filePath.split('.').slice(0, -1).join('.');
        },

        /**
         * @method isHTMLImport
         * @param {HTMLElement} htmlElement
         * @return {Boolean}
         */
        isHTMLImport(htmlElement) {

            let isInstance  = htmlElement instanceof HTMLLinkElement,
                isImport    = String(htmlElement.getAttribute('rel')).toLowerCase() === 'import',
                hasHrefAttr = htmlElement.hasAttribute('href'),
                hasTypeHtml = String(htmlElement.getAttribute('type')).toLowerCase() === 'text/html';

            return isInstance && isImport && hasHrefAttr && hasTypeHtml;

        },

        /**
         * @method resolveTimeout
         * @param {String} errorMessage
         * @param {Function} reject
         * @return {void}
         */
        resolveTimeout(errorMessage, reject) {
            setTimeout(() => reject(errorMessage), options.RESOLVE_TIMEOUT);
        },

        /**
         * Casts primitive values into their respective types. Ignores complex types, including JSON objects.
         * Currently supported are: booleans, integers, and floats.
         *
         * @method typecastProperty
         * @param {String} value
         * @return {*}
         */
        typecastProperty(value) {

            if (String(value).match(/^\d+$/)) {
                value = Number(value);
            }

            if (String(value).match(/^\d+\.\d+/i)) {
                value = parseFloat(value);
            }

            if (~['true', 'false'].indexOf(value)) {
                value = value === 'true';
            }

            return value;

        },

        /**
         * @method tryRegisterElement
         * @param {String} name
         * @param {Object} properties
         * @return {void}
         */
        tryRegisterElement(name, properties) {

            /**
             * @constant ERROR_MAP
             * @type {Object}
             */
            const ERROR_MAP = {
                'A type with that name is already registered': `Custom element "${name}" has already been registered`,
                'The type name is invalid': `Element name ${name} is invalid and must consist of at least one hyphen`
            };

            try {

                $document.registerElement(name, properties);

            } catch (e) {

                let errorData = Object.keys(ERROR_MAP).map((error) => {

                    let regExp = new RegExp(error, 'i');

                    if (e.message.match(regExp)) {
                        logger.error(ERROR_MAP[error]);
                        return true;
                    }

                    return false;

                });

                if (!errorData.some((model) => model)) {
                    throw(e);
                }

            }

        }

    };

})(window.document);