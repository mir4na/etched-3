"use client";

import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
    duration?: number;
}

export function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(onClose, 300);
    };

    return (
        <div className={`${styles.toast} ${styles[type]} ${isExiting ? styles.exit : ""}`}>
            <div className={styles.icon}>
                {type === "success" && "✓"}
                {type === "error" && "✕"}
                {type === "info" && "ℹ"}
                {type === "warning" && "⚠"}
            </div>
            <span className={styles.message}>{message}</span>
            <button className={styles.close} onClick={handleClose}>×</button>
        </div>
    );
}

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContainerProps {
    toasts: ToastItem[];
    removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <div className={styles.container}>
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
}

export function useToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = (message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return { toasts, addToast, removeToast };
}
