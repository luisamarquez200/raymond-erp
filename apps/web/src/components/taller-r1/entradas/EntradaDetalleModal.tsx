'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { entradasApi } from '@/services/taller-r1/entradas.service';

interface EntradaDetalleModalProps {
    entradaId: string | null;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface DetalleForm {
    serial_equipo: string;
    tipo_entrada: string;
    estado: string;
    calificacion: string;
    comentario_1: string;
    comentario_2: string;
    comentario_3: string;
    comentario_4: string;
}

export function EntradaDetalleModal({ entradaId, open, onClose, onSuccess }: EntradaDetalleModalProps) {
    const [formData, setFormData] = useState<DetalleForm>({
        serial_equipo: '',
        tipo_entrada: 'Compra',
        estado: 'Revisar',
        calificacion: '',
        comentario_1: '',
        comentario_2: '',
        comentario_3: '',
        comentario_4: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!entradaId) {
            toast.error('No se ha seleccionado una entrada');
            return;
        }

        try {
            await entradasApi.createDetalle(entradaId, formData);
            toast.success('Detalle de equipo agregado correctamente');
            resetForm();
            onSuccess?.();
            onClose();
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al agregar el detalle del equipo'));
        }
    };

    const resetForm = () => {
        setFormData({
            serial_equipo: '',
            tipo_entrada: 'Compra',
            estado: 'Revisar',
            calificacion: '',
            comentario_1: '',
            comentario_2: '',
            comentario_3: '',
            comentario_4: '',
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Agregar Detalle de Equipo</h2>
                    <button
                        onClick={() => {
                            resetForm();
                            onClose();
                        }}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Serial del Equipo *
                            </label>
                            <input
                                type="text"
                                value={formData.serial_equipo}
                                onChange={(e) => setFormData({ ...formData, serial_equipo: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de Entrada
                            </label>
                            <select
                                value={formData.tipo_entrada}
                                onChange={(e) => setFormData({ ...formData, tipo_entrada: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="Compra">Compra</option>
                                <option value="Renta">Renta</option>
                                <option value="Servicio">Servicio</option>
                                <option value="Garantía">Garantía</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estado
                            </label>
                            <select
                                value={formData.estado}
                                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="Revisar">Revisar</option>
                                <option value="Bueno">Bueno</option>
                                <option value="Malo">Malo</option>
                                <option value="Reparación">Reparación</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Calificación
                            </label>
                            <select
                                value={formData.calificacion}
                                onChange={(e) => setFormData({ ...formData, calificacion: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="">Seleccionar...</option>
                                <option value="A">A - Excelente</option>
                                <option value="B">B - Bueno</option>
                                <option value="C">C - Regular</option>
                                <option value="D">D - Malo</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Comentario 1
                            </label>
                            <textarea
                                value={formData.comentario_1}
                                onChange={(e) => setFormData({ ...formData, comentario_1: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Comentario 2
                            </label>
                            <textarea
                                value={formData.comentario_2}
                                onChange={(e) => setFormData({ ...formData, comentario_2: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Comentario 3
                            </label>
                            <textarea
                                value={formData.comentario_3}
                                onChange={(e) => setFormData({ ...formData, comentario_3: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Comentario 4
                            </label>
                            <textarea
                                value={formData.comentario_4}
                                onChange={(e) => setFormData({ ...formData, comentario_4: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => {
                                resetForm();
                                onClose();
                            }}
                            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Guardar Detalle
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
