 <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-rose-400 uppercase tracking-widest">
                Avaroganam Scale Formula (Descending)
              </label>
              <input
                type="text"
                disabled={janyaModalMode === "view"}
                value={janyaFormFields.avaroganam}
                onChange={(e) =>
                  setJanyaFormFields({
                    ...janyaFormFields,
                    avaroganam: e.target.value,
                  })
                }
                required
                placeholder="e.g. S2 P M1 R3 S1"
                className="w-full bg-black border-2 border-gray-700 focus:border-rose-400 p-3 rounded-xl font-mono text-rose-400 text-sm font-bold tracking-widest outline-none disabled:opacity-50 uppercase"
              />
            </div> 

            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-rose-400 uppercase tracking-widest">
                Avaroganam GAMAKKAM Formula 
              </label>
              <input
                type="text"
                disabled={janyaModalMode === "view"}
                value={janyaFormFields.avaroganam_gamakkam}
                onChange={(e) =>
                  setJanyaFormFields({
                    ...janyaFormFields,
                    avaroganam: e.target.value,
                  })
                }
                required
                placeholder="e.g. S2 P M1 R3 S1"
                className="w-full bg-black border-2 border-gray-700 focus:border-rose-400 p-3 rounded-xl font-mono text-rose-400 text-sm font-bold tracking-widest outline-none disabled:opacity-50 uppercase"
              />
            </div>