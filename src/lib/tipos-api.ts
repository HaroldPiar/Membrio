/* ARCHIVO GENERADO por `pnpm api:types` — NO editar a mano.
 * Si cambia la API, vuelve a correr el script: openapi-fetch compila contra estos tipos. */

export interface paths {
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cierra la sesión: borra la cookie membrio_session
         * @description Requiere sesión (Bearer o cookie). Autenticada por cookie + método mutante exige origen del mismo sitio (defensa CSRF, spec del cliente §6). El token del body sigue siendo válido: logout solo cierra la sesión en este navegador.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sesión cerrada: cookie borrada */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/dev-login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Inicia sesión con un correo de usuario (SOLO AUTH_MODE=dev)
         * @description Correos inexistentes o inactivos responden 401 idéntico: no se revela existencia de cuentas. Además del token en el body, fija la cookie httpOnly membrio_session (Path=/, SameSite=Lax, Max-Age = expiración del JWT, Secure en producción) para el cliente web.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        correo: string;
                    };
                };
            };
            responses: {
                /** @description Sesión iniciada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Sesion"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Usuario autenticado, rol y organización */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sesión actual */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Me"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usuarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista los usuarios de la organización (solo admin) */
        get: {
            parameters: {
                query?: {
                    /** @description Cantidad de ítems por página (máx 100) */
                    limit?: number;
                    /** @description Cursor opaco devuelto en paginacion.cursor_siguiente de la página anterior */
                    cursor?: string;
                    activo?: boolean | null;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de usuarios */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"][];
                            paginacion: {
                                /** @example 20 */
                                limit: number;
                                /** @description Cursor para la página siguiente; null si no hay más */
                                cursor_siguiente: string | null;
                            };
                        };
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un usuario en la organización (solo admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UsuarioCreacion"];
                };
            };
            responses: {
                /** @description Usuario creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Usuario"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Violación de integridad o reglas de la base */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usuarios/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtiene un usuario por id (solo admin) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Usuario */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Usuario"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Desactiva un usuario — baja lógica, solo admin */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Usuario desactivado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Usuario"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Actualiza nombre, rol o activo de un usuario (solo admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        nombre?: string;
                        /**
                         * @description Roles iniciales de la matriz de permisos (spec §4)
                         * @example admin
                         * @enum {string}
                         */
                        rol?: "admin" | "operador";
                        activo?: boolean;
                    };
                };
            };
            responses: {
                /** @description Usuario actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Usuario"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Violación de integridad o reglas de la base */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/planes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista los planes de la organización */
        get: {
            parameters: {
                query?: {
                    /** @description Cantidad de ítems por página (máx 100) */
                    limit?: number;
                    /** @description Cursor opaco devuelto en paginacion.cursor_siguiente de la página anterior */
                    cursor?: string;
                    /** @description true/false; sin este parámetro se devuelven ambos estados */
                    activo?: boolean | null;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de planes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Plan"][];
                            paginacion: {
                                /** @example 20 */
                                limit: number;
                                /** @description Cursor para la página siguiente; null si no hay más */
                                cursor_siguiente: string | null;
                            };
                        };
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un plan (solo admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PlanCreacion"];
                };
            };
            responses: {
                /** @description Plan creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Plan"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/planes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtiene un plan por id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Plan */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Plan"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Desactiva un plan (baja lógica, solo admin) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Plan desactivado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Plan"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Actualiza un plan (solo admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @example Básico */
                        nombre?: string;
                        /**
                         * @description Monto como cadena decimal (nunca número flotante)
                         * @example 150000.00
                         */
                        valor_mensualidad?: string;
                        /**
                         * @description Monto como cadena decimal (nunca número flotante)
                         * @example 150000.00
                         */
                        valor_matricula?: string;
                    };
                };
            };
            responses: {
                /** @description Plan actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Plan"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/categorias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista las categorías (cursos) de la organización */
        get: {
            parameters: {
                query?: {
                    /** @description Cantidad de ítems por página (máx 100) */
                    limit?: number;
                    /** @description Cursor opaco devuelto en paginacion.cursor_siguiente de la página anterior */
                    cursor?: string;
                    /** @description true/false; sin este parámetro se devuelven ambas estados */
                    activa?: boolean | null;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de categorías */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Categoria"][];
                            paginacion: {
                                /** @example 20 */
                                limit: number;
                                /** @description Cursor para la página siguiente; null si no hay más */
                                cursor_siguiente: string | null;
                            };
                        };
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea una categoría (solo admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CategoriaCreacion"];
                };
            };
            responses: {
                /** @description Categoría creada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Categoria"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categorias/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtiene una categoría por id */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categoría */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Categoria"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Desactiva una categoría (baja lógica, solo admin) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categoría desactivada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Categoria"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Actualiza una categoría (solo admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @example Sub-10 Mariposa */
                        nombre?: string;
                    };
                };
            };
            responses: {
                /** @description Categoría actualizada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Categoria"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/eps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Catálogo global de EPS (solo lectura) */
        get: {
            parameters: {
                query?: {
                    /** @description true/false; por defecto todas */
                    activa?: boolean | null;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Catálogo de EPS */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Eps"][];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/afiliados": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Lista afiliados con filtros y paginación
         * @description estado_pago filtra sobre el estado CALCULADO (solo afiliados activos); el resto de filtros se aplican en SQL.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Cantidad de ítems por página (máx 100) */
                    limit?: number;
                    /** @description Cursor opaco devuelto en paginacion.cursor_siguiente de la página anterior */
                    cursor?: string;
                    /** @description Búsqueda por nombre o número de documento (parcial, case-insensitive) */
                    q?: string;
                    /** @description true/false; sin este parámetro se devuelven ambos */
                    activo?: boolean | null;
                    categoria?: string;
                    plan?: string;
                    /** @description Requiere calcular el estado de cada afiliado; solo afiliados activos */
                    estado_pago?: "al_dia" | "por_vencer" | "en_mora";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de afiliados */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Afiliado"][];
                            paginacion: {
                                /** @example 20 */
                                limit: number;
                                /** @description Cursor para la página siguiente; null si no hay más */
                                cursor_siguiente: string | null;
                            };
                        };
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un afiliado (admin y operador) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AfiliadoCreacion"];
                };
            };
            responses: {
                /** @description Afiliado creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Afiliado"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Violación de integridad o reglas de la base */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/afiliados/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtiene un afiliado por id (con estado de pago calculado) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Afiliado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Afiliado"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Actualiza un afiliado (admin y operador) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /**
                         * Format: uuid
                         * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                         */
                        plan_id?: string;
                        /**
                         * Format: uuid
                         * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                         */
                        categoria_id?: string;
                        /** @enum {string} */
                        tipo_documento?: "TI" | "CC" | "RC" | "PAS" | "PPT";
                        numero_documento?: string;
                        nombre?: string;
                        celular?: string;
                        correo?: string;
                        /**
                         * Format: uuid
                         * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                         */
                        eps_id?: string | null;
                        /** @enum {string} */
                        tipo_sangre?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
                        /**
                         * Format: date
                         * @example 2014-03-15
                         */
                        fecha_nacimiento?: string;
                        genero?: string | null;
                        medio_captacion?: string | null;
                        direccion?: string | null;
                        /**
                         * @default 0
                         * @example 0.1000
                         */
                        descuento?: string;
                        /**
                         * Format: date
                         * @example 2026-02-01
                         */
                        fecha_ingreso?: string;
                        /**
                         * Format: date
                         * @example 2026-02-01
                         */
                        fecha_consentimiento?: string | null;
                    };
                };
            };
            responses: {
                /** @description Afiliado actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Afiliado"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Violación de integridad o reglas de la base */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/afiliados/{id}/retiro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Retira un afiliado — lógico, solo admin (§8.5) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["Retiro"];
                };
            };
            responses: {
                /** @description Afiliado retirado (activo=false con fecha y motivo) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Afiliado"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/afiliados/{id}/acudientes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista los acudientes de un afiliado */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Acudientes del afiliado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Acudiente"][];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Agrega un acudiente al afiliado (admin y operador) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AcudienteCreacion"];
                };
            };
            responses: {
                /** @description Acudiente creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Acudiente"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/acudientes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Elimina un acudiente (borrado físico; admin y operador) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Acudiente eliminado */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Actualiza un acudiente (admin y operador) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        numero_documento?: string;
                        nombre?: string;
                        celular?: string | null;
                        correo?: string | null;
                        es_principal?: boolean;
                    };
                };
            };
            responses: {
                /** @description Acudiente actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Acudiente"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/pagos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista pagos con filtros y paginación (sin líneas de detalle) */
        get: {
            parameters: {
                query?: {
                    /** @description Cantidad de ítems por página (máx 100) */
                    limit?: number;
                    /** @description Cursor opaco devuelto en paginacion.cursor_siguiente de la página anterior */
                    cursor?: string;
                    estado?: "pendiente" | "verificado" | "rechazado";
                    afiliado?: string;
                    /** @description Filtrar por fecha de creación >= desde */
                    desde?: string;
                    /** @description Filtrar por fecha de creación <= hasta */
                    hasta?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de pagos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["PagoResumen"][];
                            paginacion: {
                                /** @example 20 */
                                limit: number;
                                /** @description Cursor para la página siguiente; null si no hay más */
                                cursor_siguiente: string | null;
                            };
                        };
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Registra un pago con sus líneas (nace pendiente)
         * @description monto_total debe igualar la suma de líneas; fecha_cobertura día 1; matrícula en enero; cada afiliado pertenece a la organización.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PagoCreacion"];
                };
            };
            responses: {
                /** @description Pago creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Pago"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Violación de integridad o reglas de la base */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pagos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Obtiene un pago con sus líneas */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Pago */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Pago"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pagos/{id}/estado": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Verifica o rechaza un pago (admin y operador)
         * @description Al rechazar se liberan sus líneas de detalle para permitir un reintento del mismo mes (§8.1.5). Un pago rechazado no se re-verifica.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PagoEstado"];
                };
            };
            responses: {
                /** @description Pago con su nuevo estado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Pago"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto: registro duplicado o transición de estado no permitida */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/archivos/subida": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pide una URL firmada de subida (PDF/JPG/PNG/WEBP, máx 10 MB) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SubidaArchivo"];
                };
            };
            responses: {
                /** @description URL firmada de subida; la ruta devuelta es la que se guarda en la base */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UrlFirmada"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Rol insuficiente para la operación */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archivos/lectura": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pide una URL firmada de lectura para una ruta de la organización */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["LecturaArchivo"];
                };
            };
            responses: {
                /** @description URL firmada de lectura */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UrlFirmada"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Recurso inexistente (incluye recursos de otra organización) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/resumen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Conteos de afiliados por estado, pagos pendientes y recaudo del mes */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Resumen */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DashboardResumen"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/morosidad": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cartera: afiliados en mora con meses adeudados y valor estimado */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Cartera pendiente */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DashboardMorosidad"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/recaudo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Recaudo verificado por mes (últimos 12 meses) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Serie mensual de recaudo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DashboardRecaudo"];
                    };
                };
                /** @description Validación: datos de entrada inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sesión ausente, inválida o usuario inactivo */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Error: {
            error: {
                /** @example NO_ENCONTRADO */
                code: string;
                /** @example Afiliado no encontrado */
                message: string;
                /**
                 * @description Detalles adicionales; vacío salvo en errores de validación
                 * @example []
                 */
                details: unknown[];
            };
        };
        Sesion: {
            /** @description JWT Bearer (HS256) */
            token: string;
            /** @enum {string} */
            token_type: "Bearer";
            /** @description Unix seconds (exp del JWT) */
            expira_en?: number | null;
            usuario: {
                /** Format: uuid */
                id: string;
                correo: string;
                nombre: string;
                rol: string;
                /** Format: uuid */
                organizacion_id: string;
            };
        };
        Me: {
            /** Format: uuid */
            id: string;
            /** @example admin@truchas.test */
            correo: string;
            nombre: string;
            /** @example admin */
            rol: string;
            /** Format: uuid */
            organizacion_id: string;
        };
        Usuario: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /**
             * Format: email
             * @example admin@truchas.test
             */
            correo: string;
            /** @example María Pérez */
            nombre: string;
            /**
             * @description Roles iniciales de la matriz de permisos (spec §4)
             * @example admin
             * @enum {string}
             */
            rol: "admin" | "operador";
            activo: boolean;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
        };
        UsuarioCreacion: {
            /**
             * Format: email
             * @example operador2@truchas.test
             */
            correo: string;
            nombre: string;
            /**
             * @description Roles iniciales de la matriz de permisos (spec §4)
             * @example admin
             * @enum {string}
             */
            rol: "admin" | "operador";
        };
        Plan: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /** @example Básico */
            nombre: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            valor_mensualidad: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            valor_matricula: string;
            activo: boolean;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
        };
        PlanCreacion: {
            /** @example Básico */
            nombre: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            valor_mensualidad: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            valor_matricula: string;
        };
        Categoria: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /** @example Sub-10 Mariposa */
            nombre: string;
            activa: boolean;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
        };
        CategoriaCreacion: {
            /** @example Sub-10 Mariposa */
            nombre: string;
        };
        Eps: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /** @example EPS Salud Total */
            nombre: string;
            activa: boolean;
        };
        Afiliado: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            plan_id: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            categoria_id: string;
            /** @enum {string} */
            tipo_documento: "TI" | "CC" | "RC" | "PAS" | "PPT";
            /** @example 1002345678 */
            numero_documento: string;
            /** @example Sofía Ramírez */
            nombre: string;
            /** @example 3001234567 */
            celular: string;
            /** @example familia@ejemplo.com */
            correo: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            eps_id: string | null;
            /** @enum {string} */
            tipo_sangre: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
            /**
             * Format: date
             * @example 2014-03-15
             */
            fecha_nacimiento: string;
            genero: string | null;
            medio_captacion: string | null;
            direccion: string | null;
            /**
             * @description Fracción entre 0 y 1
             * @example 0.0000
             */
            descuento: string;
            /**
             * Format: date
             * @example 2026-02-01
             */
            fecha_ingreso: string;
            /**
             * Format: date
             * @example 2026-02-01
             */
            fecha_retiro: string | null;
            motivo_retiro: string | null;
            activo: boolean;
            /**
             * Format: date
             * @example 2026-02-01
             */
            fecha_consentimiento: string | null;
            url_documentos: string[] | null;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
            /**
             * @description Solo en detalle y listado: calculado, null si el afiliado está retirado
             * @example al_dia
             * @enum {string|null}
             */
            estado_pago: "al_dia" | "por_vencer" | "en_mora" | null;
        };
        AfiliadoCreacion: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            plan_id: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            categoria_id: string;
            /** @enum {string} */
            tipo_documento: "TI" | "CC" | "RC" | "PAS" | "PPT";
            numero_documento: string;
            nombre: string;
            celular: string;
            correo: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            eps_id?: string | null;
            /** @enum {string} */
            tipo_sangre: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
            /**
             * Format: date
             * @example 2014-03-15
             */
            fecha_nacimiento: string;
            genero?: string | null;
            medio_captacion?: string | null;
            direccion?: string | null;
            /**
             * @default 0
             * @example 0.1000
             */
            descuento: string;
            /**
             * Format: date
             * @example 2026-02-01
             */
            fecha_ingreso: string;
            /**
             * Format: date
             * @example 2026-02-01
             */
            fecha_consentimiento?: string | null;
        };
        Retiro: {
            /**
             * Format: date
             * @description Fecha del retiro; por defecto hoy (zona America/Bogota)
             * @example 2026-02-01
             */
            fecha_retiro?: string;
            motivo_retiro?: string;
        };
        Acudiente: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            afiliado_id: string;
            /** @example 79123456 */
            numero_documento: string;
            /** @example Carlos Ramírez */
            nombre: string;
            celular: string | null;
            correo: string | null;
            /** @description Un solo principal por afiliado (índice único parcial en la base) */
            es_principal: boolean;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
        };
        AcudienteCreacion: {
            numero_documento: string;
            nombre: string;
            celular?: string | null;
            correo?: string | null;
            /** @default false */
            es_principal: boolean;
        };
        PagoResumen: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            monto_total: string;
            /**
             * @example pendiente
             * @enum {string}
             */
            estado: "pendiente" | "verificado" | "rechazado";
            /** @enum {string} */
            factura_tipo_documento: "TI" | "CC" | "RC" | "PAS" | "PPT" | "NIT";
            /** @example 900123456-1 */
            factura_documento: string;
            /** @example Acme S.A.S. */
            factura_nombre: string;
            factura_celular: string | null;
            factura_correo: string | null;
            observaciones: string | null;
            /** @description Ruta de objeto en Storage (no es URL pública, §10) */
            url_comprobante: string | null;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            revisado_por: string | null;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            revisado_en: string | null;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
        };
        Pago: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            monto_total: string;
            /**
             * @example pendiente
             * @enum {string}
             */
            estado: "pendiente" | "verificado" | "rechazado";
            /** @enum {string} */
            factura_tipo_documento: "TI" | "CC" | "RC" | "PAS" | "PPT" | "NIT";
            /** @example 900123456-1 */
            factura_documento: string;
            /** @example Acme S.A.S. */
            factura_nombre: string;
            factura_celular: string | null;
            factura_correo: string | null;
            observaciones: string | null;
            /** @description Ruta de objeto en Storage (no es URL pública, §10) */
            url_comprobante: string | null;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            revisado_por: string | null;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            revisado_en: string | null;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            created_at: string;
            /**
             * Format: date-time
             * @example 2026-02-15T10:30:00.000Z
             */
            updated_at: string;
            lineas: components["schemas"]["LineaPago"][];
        };
        LineaPago: {
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            id: string;
            /**
             * Format: uuid
             * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
             */
            afiliado_id: string;
            /**
             * @description matricula implica fecha_cobertura = 1 de enero del año (§8.2)
             * @example mensualidad
             * @enum {string}
             */
            concepto: "mensualidad" | "matricula";
            /**
             * Format: date
             * @example 2026-02-01
             */
            fecha_cobertura: string;
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            monto: string;
        };
        PagoCreacion: {
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            monto_total: string;
            /** @enum {string} */
            factura_tipo_documento: "TI" | "CC" | "RC" | "PAS" | "PPT" | "NIT";
            factura_documento: string;
            factura_nombre: string;
            factura_celular?: string | null;
            factura_correo?: string | null;
            observaciones?: string | null;
            url_comprobante?: string | null;
            lineas: {
                /**
                 * Format: uuid
                 * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                 */
                afiliado_id: string;
                /**
                 * @description matricula implica fecha_cobertura = 1 de enero del año (§8.2)
                 * @example mensualidad
                 * @enum {string}
                 */
                concepto: "mensualidad" | "matricula";
                /**
                 * Format: date
                 * @example 2026-02-01
                 */
                fecha_cobertura: string;
                /**
                 * @description Monto como cadena decimal (nunca número flotante)
                 * @example 150000.00
                 */
                monto: string;
            }[];
        };
        PagoEstado: {
            /**
             * @description verificado aprueba el comprobante; rechazado libera sus líneas de detalle (§8.1.5)
             * @example verificado
             * @enum {string}
             */
            estado: "verificado" | "rechazado";
        };
        UrlFirmada: {
            /**
             * @description Ruta del objeto a guardar en la base (prefijo = organizacion_id)
             * @example 3f2a.../comprobante/9c1b....pdf
             */
            ruta: string;
            /**
             * @description URL firmada de corta duración
             * @example http://localhost:3000/api/v1/archivos/local/subida?ruta=...&firma=...
             */
            url: string;
            /**
             * @example PUT
             * @enum {string}
             */
            metodo: "PUT" | "GET";
            /**
             * Format: date-time
             * @example 2026-10-24T15:00:00.000Z
             */
            expira_en: string;
            /** @enum {string|null} */
            content_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null;
            /** @example 10485760 */
            tamano_max_bytes: number;
        };
        SubidaArchivo: {
            /**
             * @example comprobante
             * @enum {string}
             */
            tipo: "comprobante" | "documento";
            /**
             * @example application/pdf
             * @enum {string}
             */
            contenido_tipo: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
            /** @example 102400 */
            tamano_bytes: number;
        };
        LecturaArchivo: {
            /**
             * @description Ruta de objeto almacenada (debe pertenecer a la organización de la sesión)
             * @example 3f2a.../comprobante/9c1b....pdf
             */
            ruta: string;
        };
        DashboardResumen: {
            afiliados: {
                total: number;
                activos: number;
                retirados: number;
                al_dia: number;
                por_vencer: number;
                en_mora: number;
            };
            pagos: {
                /** @description Pagos pendientes de verificación */
                pendientes: number;
            };
            /**
             * @description Monto como cadena decimal (nunca número flotante)
             * @example 150000.00
             */
            recaudo_mes_actual: string;
        };
        DashboardMorosidad: {
            /**
             * Format: date
             * @description Fecha de cálculo (zona America/Bogota)
             * @example 2026-02-01
             */
            fecha: string;
            /**
             * @description Suma de lo adeudado por los afiliados en mora
             * @example 150000.00
             */
            total_cartera: string;
            deudores: {
                /**
                 * Format: uuid
                 * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                 */
                afiliado_id: string;
                nombre: string;
                /**
                 * Format: uuid
                 * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                 */
                plan_id: string;
                /**
                 * Format: uuid
                 * @example 0b6f8f5e-8f4e-4a2b-9d3a-1c2b3d4e5f60
                 */
                categoria_id: string;
                meses_adeudados: string[];
                /**
                 * @description Monto como cadena decimal (nunca número flotante)
                 * @example 150000.00
                 */
                valor_adeudado: string;
            }[];
        };
        DashboardRecaudo: {
            meses: {
                /**
                 * @description AAAA-MM (fecha_cobertura)
                 * @example 2026-09
                 */
                mes: string;
                /**
                 * @description Monto como cadena decimal (nunca número flotante)
                 * @example 150000.00
                 */
                total: string;
            }[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
