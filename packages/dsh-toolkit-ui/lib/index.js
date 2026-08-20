//#region src/host/index.ts
const inject = [];
function apply(ctx) {
	ctx.effect(() => () => void 0, "dsh-toolkit-ui: host no-op");
}
//#endregion
export { apply, inject };
