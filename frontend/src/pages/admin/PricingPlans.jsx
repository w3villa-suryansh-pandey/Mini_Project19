import { useEffect, useState } from 'react'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { createAdminPlan, deleteAdminPlan, getAdminPlans, updateAdminPlan } from '../../services/api.js'

const emptyPlan = { name: '', priceRupees: '', durationValue: '1', durationUnit: 'day', features: '', isActive: true }

function PricingPlans() {
	const [plans, setPlans] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [form, setForm] = useState(emptyPlan)
	const [editingId, setEditingId] = useState(null)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [notice, setNotice] = useState('')
	const [error, setError] = useState('')

	async function loadPlans() {
		setError('')
		try {
			const { plans: savedPlans } = await getAdminPlans()
			setPlans(savedPlans)
		} catch (loadError) {
			setError(loadError.message)
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		let isCurrent = true
		getAdminPlans()
			.then(({ plans: savedPlans }) => {
				if (isCurrent) setPlans(savedPlans)
			})
			.catch((loadError) => {
				if (isCurrent) setError(loadError.message)
			})
			.finally(() => {
				if (isCurrent) setIsLoading(false)
			})

		return () => { isCurrent = false }
	}, [])

	function openCreateForm() {
		setEditingId(null)
		setForm(emptyPlan)
		setIsFormOpen(true)
		setNotice('')
	}

	function editPlan(plan) {
		setEditingId(plan.id)
		setForm({
			name: plan.name,
			priceRupees: String(plan.priceRupees),
			durationValue: String(plan.durationValue),
			durationUnit: plan.durationUnit,
			features: plan.features.join('\n'),
			isActive: plan.isActive,
		})
		setIsFormOpen(true)
		setNotice('')
		setError('')
	}

	async function savePlan(event) {
		event.preventDefault()
		setError('')
		const planData = {
			...form,
			priceRupees: Number(form.priceRupees),
			durationValue: Number(form.durationValue),
			features: form.features.split('\n').map((feature) => feature.trim()).filter(Boolean),
		}
		try {
			if (editingId) await updateAdminPlan(editingId, planData)
			else await createAdminPlan(planData)
			await loadPlans()
			setIsFormOpen(false)
			setNotice(editingId ? 'Plan updated.' : 'Plan created.')
			setForm(emptyPlan)
			setEditingId(null)
		} catch (saveError) {
			setError(saveError.message)
		}
	}

	async function removePlan(plan) {
		if (!window.confirm(`Remove ${plan.name} from the user pricing page?`)) return
		setError('')
		try {
			const result = await deleteAdminPlan(plan.id)
			await loadPlans()
			setNotice(result.message)
		} catch (deleteError) {
			setError(deleteError.message)
		}
	}

	return (
		<main className="admin-layout">
			<AdminSidebar active="plans" />
			<section className="admin-main-panel">
				<header className="admin-topbar"><div className="admin-breadcrumb">Administration <span>/</span> Pricing plans</div><div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<span className="admin-topbar-avatar">AD</span></div></header>
				<div className="admin-content">
					<div className="admin-page-heading compact">
						<div><p className="admin-eyebrow">SUBSCRIPTION MANAGEMENT</p><h1>Pricing plans</h1><p>Create and update the plans offered to users.</p></div>
						<button className="admin-primary-button" type="button" onClick={openCreateForm}>＋ Create plan</button>
					</div>

					{notice && <p className="admin-inline-notice" role="status">{notice}</p>}
					{error && <p className="admin-inline-notice" role="alert">{error}</p>}

					{isFormOpen && (
						<form className="admin-panel plan-editor" onSubmit={savePlan}>
							<div className="admin-panel-heading"><div><h2>{editingId ? 'Update plan' : 'Create a plan'}</h2><p>Prices are charged in INR. Duration starts after confirmed payment.</p></div><button className="admin-close-button" type="button" aria-label="Close plan form" onClick={() => setIsFormOpen(false)}>×</button></div>
							<div className="plan-form-grid">
								<label>Plan name<input required maxLength="60" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Weekend pass" /></label>
								<label>Price (₹)<input required type="number" min="1" max="1000000" step="0.01" value={form.priceRupees} onChange={(event) => setForm({ ...form, priceRupees: event.target.value })} placeholder="10.00" /></label>
								<label>Duration<input required type="number" min="1" max="3650" step="1" value={form.durationValue} onChange={(event) => setForm({ ...form, durationValue: event.target.value })} /></label>
								<label>Duration unit<select value={form.durationUnit} onChange={(event) => setForm({ ...form, durationUnit: event.target.value })}><option value="hour">Hour(s)</option><option value="day">Day(s)</option><option value="week">Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option></select></label>
								<label className="plan-form-wide">Features<textarea required rows="3" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder={'PDF editing tools\nEdited PDF downloads'} /></label>
								<label>Status<select value={form.isActive ? 'active' : 'draft'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}><option value="active">Active</option><option value="draft">Draft</option></select></label>
							</div>
							<div className="plan-editor-actions"><button className="admin-secondary-button" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="admin-primary-button" type="submit">{editingId ? 'Save plan' : 'Create plan'}</button></div>
						</form>
					)}

					<section className="admin-panel plans-panel">
						<div className="users-panel-heading"><div><h2>All plans</h2><p>{plans.length} plans configured</p></div><span className="admin-demo-tag">DATABASE</span></div>
						<div className="admin-table-scroll">
							<table className="admin-table plans-table">
								<thead><tr><th>Plan</th><th>Price</th><th>Duration</th><th>Features</th><th>Status</th><th>Action</th></tr></thead>
								<tbody>
									{plans.map((plan) => (
										<tr key={plan.id}>
											<td><strong>{plan.name}</strong></td>
											<td><strong>₹{Number(plan.priceRupees).toLocaleString('en-IN')}</strong></td>
											<td>{plan.durationValue} {plan.durationUnit}{plan.durationValue === 1 ? '' : 's'}</td>
											<td className="plan-features">{plan.features.join(', ')}</td>
											<td><span className={`user-status ${plan.isArchived ? 'inactive' : plan.isActive ? 'active' : 'pending'}`}><span />{plan.isArchived ? 'Archived' : plan.isActive ? 'Active' : 'Draft'}</span></td>
											<td className="plan-actions-cell"><button className="edit-plan-button" type="button" onClick={() => editPlan(plan)}>Edit</button><button className="delete-plan-button" type="button" onClick={() => removePlan(plan)}>Delete</button></td>
										</tr>
									))}
									{!isLoading && plans.length === 0 && <tr><td className="empty-users" colSpan="6">No plans yet. Create your first plan to get started.</td></tr>}
									{isLoading && <tr><td className="empty-users" colSpan="6">Loading plans…</td></tr>}
								</tbody>
							</table>
						</div>
						<p className="plan-data-note">Deleting a plan with paid subscriptions archives it to preserve purchase history.</p>
					</section>
				</div>
			</section>
		</main>
	)
}

export default PricingPlans
