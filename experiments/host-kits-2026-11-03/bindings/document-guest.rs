pub type Document = loop_::document_tool::documents::Document;
pub type Failure = loop_::document_tool::documents::Failure;
#[doc(hidden)]
#[allow(non_snake_case, unused_unsafe)]
pub unsafe fn _export_replace_text_cabi<T_: Guest>(
    arg0: i32,
    arg1: *mut u8,
    arg2: usize,
    arg3: *mut u8,
    arg4: usize,
) -> i32 {
    unsafe {
        #[cfg(target_arch = "wasm32")] _rt::run_ctors_once();
        wit_bindgen::rt::async_support::start_task(async move {
            let _task_cancel = wit_bindgen::rt::async_support::TaskCancelOnDrop::new();
            let result3 = &{
                let handle0;
                let len1 = arg2;
                let bytes1 = _rt::Vec::from_raw_parts(arg1.cast(), len1, len1);
                let len2 = arg4;
                let bytes2 = _rt::Vec::from_raw_parts(arg3.cast(), len2, len2);
                T_::replace_text(
                        {
                            handle0 = loop_::document_tool::documents::Document::from_handle(
                                arg0 as u32,
                            );
                            &handle0
                        },
                        _rt::string_lift(bytes1),
                        _rt::string_lift(bytes2),
                    )
                    .await
            };
            let (
                result11_0,
                result11_1,
                result11_2,
                result11_3,
                result11_4,
                result11_5,
            ) = match result3 {
                Ok(e) => {
                    let vec4 = e;
                    let ptr4 = vec4.as_ptr().cast::<u8>();
                    let len4 = vec4.len();
                    (
                        0i32,
                        ptr4.cast_mut(),
                        len4 as *mut u8,
                        0usize,
                        ::core::ptr::null_mut(),
                        0usize,
                    )
                }
                Err(e) => {
                    use loop_::document_tool::documents::Failure as V9;
                    let (result10_0, result10_1, result10_2, result10_3, result10_4) = match e {
                        V9::Denied => {
                            (
                                0i32,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                            )
                        }
                        V9::Revoked => {
                            (
                                1i32,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                            )
                        }
                        V9::Conflict(e) => {
                            let loop_::document_tool::documents::Snapshot {
                                revision: revision5,
                                source: source5,
                            } = e;
                            let vec6 = revision5;
                            let ptr6 = vec6.as_ptr().cast::<u8>();
                            let len6 = vec6.len();
                            let vec7 = source5;
                            let ptr7 = vec7.as_ptr().cast::<u8>();
                            let len7 = vec7.len();
                            (2i32, ptr6.cast_mut(), len6, ptr7.cast_mut(), len7)
                        }
                        V9::InvalidSource(e) => {
                            let vec8 = e;
                            let ptr8 = vec8.as_ptr().cast::<u8>();
                            let len8 = vec8.len();
                            (
                                3i32,
                                ptr8.cast_mut(),
                                len8,
                                ::core::ptr::null_mut(),
                                0usize,
                            )
                        }
                        V9::Cancelled => {
                            (
                                4i32,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                            )
                        }
                        V9::Unavailable => {
                            (
                                5i32,
                                ::core::ptr::null_mut(),
                                0usize,
                                ::core::ptr::null_mut(),
                                0usize,
                            )
                        }
                    };
                    (
                        1i32,
                        result10_0 as *mut u8,
                        result10_1,
                        result10_2,
                        result10_3,
                        result10_4,
                    )
                }
            };
            #[cfg(target_arch = "wasm32")]
            #[link(wasm_import_module = "[export]$root")]
            unsafe extern "C" {
                #[link_name = "[task-return]replace-text"]
                fn wit_import12(
                    _: i32,
                    _: *mut u8,
                    _: *mut u8,
                    _: usize,
                    _: *mut u8,
                    _: usize,
                );
            }
            #[cfg(not(target_arch = "wasm32"))]
            unsafe extern "C" fn wit_import12(
                _: i32,
                _: *mut u8,
                _: *mut u8,
                _: usize,
                _: *mut u8,
                _: usize,
            ) {
                unreachable!()
            }
            _task_cancel.forget();
            wit_import12(
                result11_0,
                result11_1,
                result11_2,
                result11_3,
                result11_4,
                result11_5,
            );
        })
    }
}
#[doc(hidden)]
#[allow(non_snake_case)]
pub unsafe fn __callback_replace_text(event0: u32, event1: u32, event2: u32) -> u32 {
    unsafe { wit_bindgen::rt::async_support::callback(event0, event1, event2) }
}
pub trait Guest {
    #[allow(async_fn_in_trait)]
    async fn replace_text(
        document: &Document,
        from: _rt::String,
        to: _rt::String,
    ) -> ::core::result::Result<_rt::String, Failure>;
}
#[doc(hidden)]
macro_rules! __export_world_tool_cabi {
    ($ty:ident with_types_in $($path_to_types:tt)*) => {
        const _ : () = { #[unsafe (export_name = "[async-lift]replace-text")] unsafe
        extern "C" fn export_replace_text(arg0 : i32, arg1 : * mut u8, arg2 : usize, arg3
        : * mut u8, arg4 : usize,) -> i32 { unsafe { $($path_to_types)*::
        _export_replace_text_cabi::<$ty > (arg0, arg1, arg2, arg3, arg4) } } #[unsafe
        (export_name = "[callback][async-lift]replace-text")] unsafe extern "C" fn
        _callback_replace_text(event0 : u32, event1 : u32, event2 : u32) -> u32 { unsafe
        { $($path_to_types)*:: __callback_replace_text(event0, event1, event2) } } };
    };
}
#[doc(hidden)]
pub(crate) use __export_world_tool_cabi;
#[allow(dead_code, clippy::all)]
pub mod loop_ {
    pub mod document_tool {
        #[allow(dead_code, async_fn_in_trait, unused_imports, clippy::all)]
        pub mod documents {
            #[used]
            #[doc(hidden)]
            static __FORCE_SECTION_REF: fn() = super::super::super::__link_custom_section_describing_imports;
            use super::super::super::_rt;
            #[derive(Clone)]
            pub struct Snapshot {
                pub revision: _rt::String,
                pub source: _rt::String,
            }
            impl ::core::fmt::Debug for Snapshot {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    f.debug_struct("Snapshot")
                        .field("revision", &self.revision)
                        .field("source", &self.source)
                        .finish()
                }
            }
            #[derive(Clone)]
            pub enum Failure {
                Denied,
                Revoked,
                Conflict(Snapshot),
                InvalidSource(_rt::String),
                Cancelled,
                Unavailable,
            }
            impl ::core::fmt::Debug for Failure {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    match self {
                        Failure::Denied => f.debug_tuple("Failure::Denied").finish(),
                        Failure::Revoked => f.debug_tuple("Failure::Revoked").finish(),
                        Failure::Conflict(e) => {
                            f.debug_tuple("Failure::Conflict").field(e).finish()
                        }
                        Failure::InvalidSource(e) => {
                            f.debug_tuple("Failure::InvalidSource").field(e).finish()
                        }
                        Failure::Cancelled => {
                            f.debug_tuple("Failure::Cancelled").finish()
                        }
                        Failure::Unavailable => {
                            f.debug_tuple("Failure::Unavailable").finish()
                        }
                    }
                }
            }
            impl ::core::fmt::Display for Failure {
                fn fmt(
                    &self,
                    f: &mut ::core::fmt::Formatter<'_>,
                ) -> ::core::fmt::Result {
                    write!(f, "{:?}", self)
                }
            }
            impl ::core::error::Error for Failure {}
            #[derive(Debug)]
            #[repr(transparent)]
            pub struct Document {
                handle: _rt::Resource<Document>,
            }
            impl Document {
                #[doc(hidden)]
                pub unsafe fn from_handle(handle: u32) -> Self {
                    Self {
                        handle: unsafe { _rt::Resource::from_handle(handle) },
                    }
                }
                #[doc(hidden)]
                pub fn take_handle(&self) -> u32 {
                    _rt::Resource::take_handle(&self.handle)
                }
                #[doc(hidden)]
                pub fn handle(&self) -> u32 {
                    _rt::Resource::handle(&self.handle)
                }
            }
            unsafe impl _rt::WasmResource for Document {
                #[inline]
                unsafe fn drop(_handle: u32) {
                    #[cfg(target_arch = "wasm32")]
                    #[link(wasm_import_module = "loop:document-tool/documents@0.1.0")]
                    unsafe extern "C" {
                        #[link_name = "[resource-drop]document"]
                        fn drop(_: i32);
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    unsafe extern "C" fn drop(_: i32) {
                        unreachable!()
                    }
                    unsafe {
                        drop(_handle as i32);
                    }
                }
            }
            impl Document {
                #[allow(unused_unsafe, clippy::all)]
                #[allow(async_fn_in_trait)]
                pub async fn read(&self) -> ::core::result::Result<Snapshot, Failure> {
                    unsafe {
                        #[derive(Copy, Clone)]
                        struct ParamsLower(i32);
                        unsafe impl Send for ParamsLower {}
                        use wit_bindgen::rt::async_support::Subtask as _Subtask;
                        struct _MySubtask<'a> {
                            _unused: core::marker::PhantomData<&'a ()>,
                        }
                        #[allow(unused_parens)]
                        unsafe impl<'a> _Subtask for _MySubtask<'a> {
                            type Params = (&'a Document,);
                            type Results = ::core::result::Result<Snapshot, Failure>;
                            type ParamsLower = ParamsLower;
                            fn abi_layout(&mut self) -> ::core::alloc::Layout {
                                unsafe {
                                    ::core::alloc::Layout::from_size_align_unchecked(
                                        (6 * ::core::mem::size_of::<*const u8>()),
                                        ::core::mem::size_of::<*const u8>(),
                                    )
                                }
                            }
                            fn results_offset(&mut self) -> usize {
                                0
                            }
                            unsafe fn call_import(
                                &mut self,
                                _params: Self::ParamsLower,
                                _results: *mut u8,
                            ) -> u32 {
                                #[cfg(target_arch = "wasm32")]
                                #[link(
                                    wasm_import_module = "loop:document-tool/documents@0.1.0"
                                )]
                                unsafe extern "C" {
                                    #[link_name = "[async-lower][method]document.read"]
                                    fn call(_: i32, _: *mut u8) -> i32;
                                }
                                #[cfg(not(target_arch = "wasm32"))]
                                unsafe extern "C" fn call(_: i32, _: *mut u8) -> i32 {
                                    unreachable!()
                                }
                                unsafe { call(_params.0, _results) as u32 }
                            }
                            unsafe fn params_dealloc_lists(
                                &mut self,
                                _params: Self::ParamsLower,
                            ) {
                                unsafe {}
                            }
                            unsafe fn params_dealloc_lists_and_own(
                                &mut self,
                                _params: Self::ParamsLower,
                            ) {
                                unsafe {}
                            }
                            unsafe fn params_lower(
                                &mut self,
                                (_lower0,): Self::Params,
                                _ptr: *mut u8,
                            ) -> Self::ParamsLower {
                                unsafe { ParamsLower((_lower0).handle() as i32) }
                            }
                            unsafe fn results_lift(
                                &mut self,
                                _ptr: *mut u8,
                            ) -> Self::Results {
                                unsafe {
                                    let l0 = i32::from(*_ptr.add(0).cast::<u8>());
                                    match l0 {
                                        0 => {
                                            let e = {
                                                let l1 = *_ptr
                                                    .add(::core::mem::size_of::<*const u8>())
                                                    .cast::<*mut u8>();
                                                let l2 = *_ptr
                                                    .add(2 * ::core::mem::size_of::<*const u8>())
                                                    .cast::<usize>();
                                                let len3 = l2;
                                                let bytes3 = _rt::Vec::from_raw_parts(
                                                    l1.cast(),
                                                    len3,
                                                    len3,
                                                );
                                                let l4 = *_ptr
                                                    .add(3 * ::core::mem::size_of::<*const u8>())
                                                    .cast::<*mut u8>();
                                                let l5 = *_ptr
                                                    .add(4 * ::core::mem::size_of::<*const u8>())
                                                    .cast::<usize>();
                                                let len6 = l5;
                                                let bytes6 = _rt::Vec::from_raw_parts(
                                                    l4.cast(),
                                                    len6,
                                                    len6,
                                                );
                                                Snapshot {
                                                    revision: _rt::string_lift(bytes3),
                                                    source: _rt::string_lift(bytes6),
                                                }
                                            };
                                            Ok(e)
                                        }
                                        1 => {
                                            let e = {
                                                let l7 = i32::from(
                                                    *_ptr.add(::core::mem::size_of::<*const u8>()).cast::<u8>(),
                                                );
                                                let v17 = match l7 {
                                                    0 => Failure::Denied,
                                                    1 => Failure::Revoked,
                                                    2 => {
                                                        let e17 = {
                                                            let l8 = *_ptr
                                                                .add(2 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<*mut u8>();
                                                            let l9 = *_ptr
                                                                .add(3 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<usize>();
                                                            let len10 = l9;
                                                            let bytes10 = _rt::Vec::from_raw_parts(
                                                                l8.cast(),
                                                                len10,
                                                                len10,
                                                            );
                                                            let l11 = *_ptr
                                                                .add(4 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<*mut u8>();
                                                            let l12 = *_ptr
                                                                .add(5 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<usize>();
                                                            let len13 = l12;
                                                            let bytes13 = _rt::Vec::from_raw_parts(
                                                                l11.cast(),
                                                                len13,
                                                                len13,
                                                            );
                                                            Snapshot {
                                                                revision: _rt::string_lift(bytes10),
                                                                source: _rt::string_lift(bytes13),
                                                            }
                                                        };
                                                        Failure::Conflict(e17)
                                                    }
                                                    3 => {
                                                        let e17 = {
                                                            let l14 = *_ptr
                                                                .add(2 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<*mut u8>();
                                                            let l15 = *_ptr
                                                                .add(3 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<usize>();
                                                            let len16 = l15;
                                                            let bytes16 = _rt::Vec::from_raw_parts(
                                                                l14.cast(),
                                                                len16,
                                                                len16,
                                                            );
                                                            _rt::string_lift(bytes16)
                                                        };
                                                        Failure::InvalidSource(e17)
                                                    }
                                                    4 => Failure::Cancelled,
                                                    n => {
                                                        debug_assert_eq!(n, 5, "invalid enum discriminant");
                                                        Failure::Unavailable
                                                    }
                                                };
                                                v17
                                            };
                                            Err(e)
                                        }
                                        _ => _rt::invalid_enum_discriminant(),
                                    }
                                }
                            }
                        }
                        _MySubtask {
                            _unused: core::marker::PhantomData,
                        }
                            .call((self,))
                            .await
                    }
                }
            }
            impl Document {
                #[allow(unused_unsafe, clippy::all)]
                #[allow(async_fn_in_trait)]
                pub async fn write(
                    &self,
                    expected_revision: _rt::String,
                    source: _rt::String,
                ) -> ::core::result::Result<Snapshot, Failure> {
                    unsafe {
                        #[derive(Copy, Clone)]
                        struct ParamsLower(*mut u8);
                        unsafe impl Send for ParamsLower {}
                        use wit_bindgen::rt::async_support::Subtask as _Subtask;
                        struct _MySubtask<'a> {
                            _unused: core::marker::PhantomData<&'a ()>,
                        }
                        #[allow(unused_parens)]
                        unsafe impl<'a> _Subtask for _MySubtask<'a> {
                            type Params = (&'a Document, _rt::String, _rt::String);
                            type Results = ::core::result::Result<Snapshot, Failure>;
                            type ParamsLower = ParamsLower;
                            fn abi_layout(&mut self) -> ::core::alloc::Layout {
                                unsafe {
                                    ::core::alloc::Layout::from_size_align_unchecked(
                                        (11 * ::core::mem::size_of::<*const u8>()),
                                        ::core::mem::size_of::<*const u8>(),
                                    )
                                }
                            }
                            fn results_offset(&mut self) -> usize {
                                (5 * ::core::mem::size_of::<*const u8>())
                            }
                            unsafe fn call_import(
                                &mut self,
                                _params: Self::ParamsLower,
                                _results: *mut u8,
                            ) -> u32 {
                                #[cfg(target_arch = "wasm32")]
                                #[link(
                                    wasm_import_module = "loop:document-tool/documents@0.1.0"
                                )]
                                unsafe extern "C" {
                                    #[link_name = "[async-lower][method]document.write"]
                                    fn call(_: *mut u8, _: *mut u8) -> i32;
                                }
                                #[cfg(not(target_arch = "wasm32"))]
                                unsafe extern "C" fn call(_: *mut u8, _: *mut u8) -> i32 {
                                    unreachable!()
                                }
                                unsafe { call(_params.0, _results) as u32 }
                            }
                            unsafe fn params_dealloc_lists(
                                &mut self,
                                _params: Self::ParamsLower,
                            ) {
                                unsafe {
                                    let l0 = *_params
                                        .0
                                        .add(::core::mem::size_of::<*const u8>())
                                        .cast::<*mut u8>();
                                    let l1 = *_params
                                        .0
                                        .add(2 * ::core::mem::size_of::<*const u8>())
                                        .cast::<usize>();
                                    _rt::cabi_dealloc(l0, l1, 1);
                                    let l2 = *_params
                                        .0
                                        .add(3 * ::core::mem::size_of::<*const u8>())
                                        .cast::<*mut u8>();
                                    let l3 = *_params
                                        .0
                                        .add(4 * ::core::mem::size_of::<*const u8>())
                                        .cast::<usize>();
                                    _rt::cabi_dealloc(l2, l3, 1);
                                }
                            }
                            unsafe fn params_dealloc_lists_and_own(
                                &mut self,
                                _params: Self::ParamsLower,
                            ) {
                                unsafe {
                                    let l0 = *_params
                                        .0
                                        .add(::core::mem::size_of::<*const u8>())
                                        .cast::<*mut u8>();
                                    let l1 = *_params
                                        .0
                                        .add(2 * ::core::mem::size_of::<*const u8>())
                                        .cast::<usize>();
                                    _rt::cabi_dealloc(l0, l1, 1);
                                    let l2 = *_params
                                        .0
                                        .add(3 * ::core::mem::size_of::<*const u8>())
                                        .cast::<*mut u8>();
                                    let l3 = *_params
                                        .0
                                        .add(4 * ::core::mem::size_of::<*const u8>())
                                        .cast::<usize>();
                                    _rt::cabi_dealloc(l2, l3, 1);
                                }
                            }
                            unsafe fn params_lower(
                                &mut self,
                                (_lower0, _lower1, _lower2): Self::Params,
                                _ptr: *mut u8,
                            ) -> Self::ParamsLower {
                                let _param_ptr = unsafe { _ptr.add(0) };
                                unsafe {
                                    *_param_ptr.add(0).cast::<i32>() = (_lower0).handle()
                                        as i32;
                                }
                                let _param_ptr = unsafe {
                                    _ptr.add(::core::mem::size_of::<*const u8>())
                                };
                                unsafe {
                                    let vec0 = (_lower1.into_bytes()).into_boxed_slice();
                                    let ptr0 = vec0.as_ptr().cast::<u8>();
                                    let len0 = vec0.len();
                                    ::core::mem::forget(vec0);
                                    *_param_ptr
                                        .add(::core::mem::size_of::<*const u8>())
                                        .cast::<usize>() = len0;
                                    *_param_ptr.add(0).cast::<*mut u8>() = ptr0.cast_mut();
                                }
                                let _param_ptr = unsafe {
                                    _ptr.add((3 * ::core::mem::size_of::<*const u8>()))
                                };
                                unsafe {
                                    let vec0 = (_lower2.into_bytes()).into_boxed_slice();
                                    let ptr0 = vec0.as_ptr().cast::<u8>();
                                    let len0 = vec0.len();
                                    ::core::mem::forget(vec0);
                                    *_param_ptr
                                        .add(::core::mem::size_of::<*const u8>())
                                        .cast::<usize>() = len0;
                                    *_param_ptr.add(0).cast::<*mut u8>() = ptr0.cast_mut();
                                }
                                ParamsLower(_ptr)
                            }
                            unsafe fn results_lift(
                                &mut self,
                                _ptr: *mut u8,
                            ) -> Self::Results {
                                unsafe {
                                    let l0 = i32::from(*_ptr.add(0).cast::<u8>());
                                    match l0 {
                                        0 => {
                                            let e = {
                                                let l1 = *_ptr
                                                    .add(::core::mem::size_of::<*const u8>())
                                                    .cast::<*mut u8>();
                                                let l2 = *_ptr
                                                    .add(2 * ::core::mem::size_of::<*const u8>())
                                                    .cast::<usize>();
                                                let len3 = l2;
                                                let bytes3 = _rt::Vec::from_raw_parts(
                                                    l1.cast(),
                                                    len3,
                                                    len3,
                                                );
                                                let l4 = *_ptr
                                                    .add(3 * ::core::mem::size_of::<*const u8>())
                                                    .cast::<*mut u8>();
                                                let l5 = *_ptr
                                                    .add(4 * ::core::mem::size_of::<*const u8>())
                                                    .cast::<usize>();
                                                let len6 = l5;
                                                let bytes6 = _rt::Vec::from_raw_parts(
                                                    l4.cast(),
                                                    len6,
                                                    len6,
                                                );
                                                Snapshot {
                                                    revision: _rt::string_lift(bytes3),
                                                    source: _rt::string_lift(bytes6),
                                                }
                                            };
                                            Ok(e)
                                        }
                                        1 => {
                                            let e = {
                                                let l7 = i32::from(
                                                    *_ptr.add(::core::mem::size_of::<*const u8>()).cast::<u8>(),
                                                );
                                                let v17 = match l7 {
                                                    0 => Failure::Denied,
                                                    1 => Failure::Revoked,
                                                    2 => {
                                                        let e17 = {
                                                            let l8 = *_ptr
                                                                .add(2 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<*mut u8>();
                                                            let l9 = *_ptr
                                                                .add(3 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<usize>();
                                                            let len10 = l9;
                                                            let bytes10 = _rt::Vec::from_raw_parts(
                                                                l8.cast(),
                                                                len10,
                                                                len10,
                                                            );
                                                            let l11 = *_ptr
                                                                .add(4 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<*mut u8>();
                                                            let l12 = *_ptr
                                                                .add(5 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<usize>();
                                                            let len13 = l12;
                                                            let bytes13 = _rt::Vec::from_raw_parts(
                                                                l11.cast(),
                                                                len13,
                                                                len13,
                                                            );
                                                            Snapshot {
                                                                revision: _rt::string_lift(bytes10),
                                                                source: _rt::string_lift(bytes13),
                                                            }
                                                        };
                                                        Failure::Conflict(e17)
                                                    }
                                                    3 => {
                                                        let e17 = {
                                                            let l14 = *_ptr
                                                                .add(2 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<*mut u8>();
                                                            let l15 = *_ptr
                                                                .add(3 * ::core::mem::size_of::<*const u8>())
                                                                .cast::<usize>();
                                                            let len16 = l15;
                                                            let bytes16 = _rt::Vec::from_raw_parts(
                                                                l14.cast(),
                                                                len16,
                                                                len16,
                                                            );
                                                            _rt::string_lift(bytes16)
                                                        };
                                                        Failure::InvalidSource(e17)
                                                    }
                                                    4 => Failure::Cancelled,
                                                    n => {
                                                        debug_assert_eq!(n, 5, "invalid enum discriminant");
                                                        Failure::Unavailable
                                                    }
                                                };
                                                v17
                                            };
                                            Err(e)
                                        }
                                        _ => _rt::invalid_enum_discriminant(),
                                    }
                                }
                            }
                        }
                        _MySubtask {
                            _unused: core::marker::PhantomData,
                        }
                            .call((self, expected_revision, source))
                            .await
                    }
                }
            }
        }
    }
}
mod _rt {
    #![allow(dead_code, unused_imports, clippy::all)]
    pub use alloc_crate::string::String;
    use core::fmt;
    use core::marker;
    use core::sync::atomic::{AtomicU32, Ordering::Relaxed};
    /// A type which represents a component model resource, either imported or
    /// exported into this component.
    ///
    /// This is a low-level wrapper which handles the lifetime of the resource
    /// (namely this has a destructor). The `T` provided defines the component model
    /// intrinsics that this wrapper uses.
    ///
    /// One of the chief purposes of this type is to provide `Deref` implementations
    /// to access the underlying data when it is owned.
    ///
    /// This type is primarily used in generated code for exported and imported
    /// resources.
    #[repr(transparent)]
    pub struct Resource<T: WasmResource> {
        handle: AtomicU32,
        _marker: marker::PhantomData<T>,
    }
    /// A trait which all wasm resources implement, namely providing the ability to
    /// drop a resource.
    ///
    /// This generally is implemented by generated code, not user-facing code.
    #[allow(clippy::missing_safety_doc)]
    pub unsafe trait WasmResource {
        /// Invokes the `[resource-drop]...` intrinsic.
        unsafe fn drop(handle: u32);
    }
    impl<T: WasmResource> Resource<T> {
        #[doc(hidden)]
        pub unsafe fn from_handle(handle: u32) -> Self {
            debug_assert!(handle != 0 && handle != u32::MAX);
            Self {
                handle: AtomicU32::new(handle),
                _marker: marker::PhantomData,
            }
        }
        /// Takes ownership of the handle owned by `resource`.
        ///
        /// Note that this ideally would be `into_handle` taking `Resource<T>` by
        /// ownership. The code generator does not enable that in all situations,
        /// unfortunately, so this is provided instead.
        ///
        /// Also note that `take_handle` is in theory only ever called on values
        /// owned by a generated function. For example a generated function might
        /// take `Resource<T>` as an argument but then call `take_handle` on a
        /// reference to that argument. In that sense the dynamic nature of
        /// `take_handle` should only be exposed internally to generated code, not
        /// to user code.
        #[doc(hidden)]
        pub fn take_handle(resource: &Resource<T>) -> u32 {
            resource.handle.swap(u32::MAX, Relaxed)
        }
        #[doc(hidden)]
        pub fn handle(resource: &Resource<T>) -> u32 {
            resource.handle.load(Relaxed)
        }
    }
    impl<T: WasmResource> fmt::Debug for Resource<T> {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.debug_struct("Resource").field("handle", &self.handle).finish()
        }
    }
    impl<T: WasmResource> Drop for Resource<T> {
        fn drop(&mut self) {
            unsafe {
                match self.handle.load(Relaxed) {
                    u32::MAX => {}
                    other => T::drop(other),
                }
            }
        }
    }
    pub use alloc_crate::vec::Vec;
    pub unsafe fn string_lift(bytes: Vec<u8>) -> String {
        if cfg!(debug_assertions) {
            String::from_utf8(bytes).unwrap()
        } else {
            unsafe { String::from_utf8_unchecked(bytes) }
        }
    }
    pub unsafe fn invalid_enum_discriminant<T>() -> T {
        if cfg!(debug_assertions) {
            panic!("invalid enum discriminant")
        } else {
            unsafe { core::hint::unreachable_unchecked() }
        }
    }
    pub unsafe fn cabi_dealloc(ptr: *mut u8, size: usize, align: usize) {
        if size == 0 {
            return;
        }
        unsafe {
            let layout = alloc::Layout::from_size_align_unchecked(size, align);
            alloc::dealloc(ptr, layout);
        }
    }
    #[cfg(target_arch = "wasm32")]
    pub fn run_ctors_once() {
        wit_bindgen::rt::run_ctors_once();
    }
    extern crate alloc as alloc_crate;
    pub use alloc_crate::alloc;
}
/// Generates `#[unsafe(no_mangle)]` functions to export the specified type as
/// the root implementation of all generated traits.
///
/// For more information see the documentation of `wit_bindgen::generate!`.
///
/// ```rust
/// # macro_rules! export{ ($($t:tt)*) => (); }
/// # trait Guest {}
/// struct MyType;
///
/// impl Guest for MyType {
///     // ...
/// }
///
/// export!(MyType);
/// ```
#[allow(unused_macros)]
#[doc(hidden)]
macro_rules! __export_tool_impl {
    ($ty:ident) => {
        self::export!($ty with_types_in self);
    };
    ($ty:ident with_types_in $($path_to_types_root:tt)*) => {
        $($path_to_types_root)*:: __export_world_tool_cabi!($ty with_types_in
        $($path_to_types_root)*);
    };
}
#[doc(inline)]
pub(crate) use __export_tool_impl as export;
#[cfg(target_arch = "wasm32")]
#[unsafe(
    link_section = "component-type:wit-bindgen:0.61.1:loop:document-tool@0.1.0:tool:encoded world"
)]
#[doc(hidden)]
#[allow(clippy::octal_escapes)]
pub static __WIT_BINDGEN_COMPONENT_TYPE: [u8; 558] = *b"\
\0asm\x0d\0\x01\0\0\x19\x16wit-component-encoding\x04\0\x07\xb3\x03\x01A\x02\x01\
A\x0a\x01B\x0b\x01r\x02\x08revisions\x06sources\x04\0\x08snapshot\x03\0\0\x01q\x06\
\x06denied\0\0\x07revoked\0\0\x08conflict\x01\x01\0\x0einvalid-source\x01s\0\x09\
cancelled\0\0\x0bunavailable\0\0\x04\0\x07failure\x03\0\x02\x04\0\x08document\x03\
\x01\x01h\x04\x01j\x01\x01\x01\x03\x01C\x01\x04self\x05\0\x06\x04\0\x15[method]d\
ocument.read\x01\x07\x01C\x03\x04self\x05\x11expected-revisions\x06sources\0\x06\
\x04\0\x16[method]document.write\x01\x08\x03\0\"loop:document-tool/documents@0.1\
.0\x05\0\x02\x03\0\0\x08document\x03\0\x08document\x03\0\x01\x02\x03\0\0\x07fail\
ure\x03\0\x07failure\x03\0\x03\x01h\x02\x01j\x01s\x01\x04\x01C\x03\x08document\x05\
\x04froms\x02tos\0\x06\x04\0\x0creplace-text\x01\x07\x04\0\x1dloop:document-tool\
/tool@0.1.0\x04\0\x0b\x0a\x01\0\x04tool\x03\0\0\0G\x09producers\x01\x0cprocessed\
-by\x02\x0dwit-component\x070.258.3\x10wit-bindgen-rust\x060.61.1";
#[inline(never)]
#[doc(hidden)]
pub fn __link_custom_section_describing_imports() {
    wit_bindgen::rt::maybe_link_cabi_realloc();
}
