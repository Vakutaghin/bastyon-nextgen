package com.bastyon.app.plugins.radio;

/**
 * Ошибка радио с кодом, который понимает интерфейс (`mesh.errors.<код>`),
 * в формате команд десктопа: «код: подробности».
 */
final class RadioException extends Exception {
    final String code;

    RadioException(String code, String detail) {
        super(detail == null || detail.isEmpty() ? code : code + ": " + detail);
        this.code = code;
    }
}
