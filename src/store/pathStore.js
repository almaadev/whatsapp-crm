import { create } from "zustand";

export const usePathStore = create((set,get)=>({
    lastpath : null,
<<<<<<< HEAD

=======
    
>>>>>>> c1be5bc (Initial commit from new system)
    setPath : (path) => set({lastpath:path})
}))