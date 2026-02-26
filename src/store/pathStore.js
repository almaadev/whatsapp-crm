import { create } from "zustand";

export const usePathStore = create((set,get)=>({
    lastpath : null,

    setPath : (path) => set({lastpath:path})
}))