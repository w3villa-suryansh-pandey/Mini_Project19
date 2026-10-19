import { useEffect, useState } from 'react'
import AccountBadge from '../../components/AccountBadge.jsx'
import AdminSidebar from '../../components/AdminSidebar.jsx'
import { createAdminPlan, deleteAdminPlan, getAdminPlans, reorderAdminPlans, updateAdminPlan } from '../../services/api.js'
import { getPlanFeatureLabels, PLAN_FEATURE_OPTIONS } from '../../utils/planFeatures.js'

const emptyPlan = { name: '', priceRupees: '', durationValue: '1', durationUnit: 'day', featureKeys: [], isActive: true }

function PricingPlans() {
	const [plans, setPlans] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [form, setForm] = useState(emptyPlan)
	const [editingId, setEditingId] = useState(null)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [notice, setNotice] = useState('')
	const [error, setError] = useState('')
	const [isReordering, setIsReordering] = useState(false)

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
			featureKeys: plan.featureKeys || (plan.features?.some((feature) => /pdf editing|edited pdf/i.test(feature)) ? ['pdf_editor'] : []),
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
			featureKeys: form.featureKeys,
			features: getPlanFeatureLabels(form.featureKeys),
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

	async function movePlan(index, direction) {
		const nextIndex = index + direction
		if (nextIndex < 0 || nextIndex >= plans.length || isReordering) return

		const reorderedPlans = [...plans]
		;[reorderedPlans[index], reorderedPlans[nextIndex]] = [reorderedPlans[nextIndex], reorderedPlans[index]]
		setError('')
		setIsReordering(true)
		try {
			const { plans: savedPlans } = await reorderAdminPlans(reorderedPlans.map((plan) => plan.id))
			setPlans(savedPlans)
			setNotice('Plan order saved.')
		} catch (orderError) {
			setError(orderError.message)
		} finally {
			setIsReordering(false)
		}
	}

	return (
		<main className="admin-layout">
			<AdminSidebar active="plans" />
			<section className="admin-main-panel">
				<header className="admin-topbar"><div className="admin-breadcrumb">Administration <span>/</span> Pricing plans</div><div className="admin-topbar-user"><span className="admin-status-dot" /> System operational<AccountBadge variant="admin" /></div></header>
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
								<fieldset className="plan-form-wide plan-feature-picker"><legend>Enabled features</legend>{PLAN_FEATURE_OPTIONS.map((feature) => <label key={feature.key}><input type="checkbox" checked={form.featureKeys.includes(feature.key)} onChange={(event) => setForm((current) => ({ ...current, featureKeys: event.target.checked ? [...current.featureKeys, feature.key] : current.featureKeys.filter((key) => key !== feature.key) }))} /><span>{feature.label}</span></label>)}</fieldset>
								<label>Status<select value={form.isActive ? 'active' : 'draft'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'active' })}><option value="active">Active</option><option value="draft">Draft</option></select></label>
							</div>
							<div className="plan-editor-actions"><button className="admin-secondary-button" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="admin-primary-button" type="submit">{editingId ? 'Save plan' : 'Create plan'}</button></div>
						</form>
					)}

					<section className="admin-panel plans-panel">
						<div className="users-panel-heading"><div><h2>All plans</h2><p>{plans.length} plans configured</p></div><span className="admin-demo-tag">DATABASE</span></div>
						<div className="admin-table-scroll">
							<table className="admin-table plans-table">
								<thead><tr><th>Plan</th><th>Price</th><th>Duration</th><th>Features</th><th>Status</th><th>Order</th><th>Action</th></tr></thead>
								<tbody>
									{plans.map((plan, index) => (
										<tr key={plan.id}>
											<td><div className="plan-name-cell"><span className="plan-row-mark" aria-hidden="true">✦</span><strong>{plan.name}</strong></div></td>
											<td><span className="plan-price">₹{Number(plan.priceRupees).toLocaleString('en-IN')}</span></td>
											<td><span className="plan-duration">{plan.durationValue} {plan.durationUnit}{plan.durationValue === 1 ? '' : 's'}</span></td>
											<td className="plan-features"><div className="plan-feature-list">{plan.features.map((feature) => <span key={feature}>{feature}</span>)}{plan.features.length === 0 && <span className="plan-no-features">No features enabled</span>}</div></td>
											<td><span className={`user-status ${plan.isArchived ? 'inactive' : plan.isActive ? 'active' : 'pending'}`}><span />{plan.isArchived ? 'Archived' : plan.isActive ? 'Active' : 'Draft'}</span></td>
											<td className="plan-order-cell"><button className="plan-order-button" type="button" aria-label={`Move ${plan.name} up`} title="Move up" disabled={index === 0 || isReordering} onClick={() => movePlan(index, -1)}>↑</button><button className="plan-order-button" type="button" aria-label={`Move ${plan.name} down`} title="Move down" disabled={index === plans.length - 1 || isReordering} onClick={() => movePlan(index, 1)}>↓</button></td>
											<td className="plan-actions-cell"><button className="edit-plan-button" type="button" onClick={() => editPlan(plan)}>Edit</button><button className="delete-plan-button" type="button" onClick={() => removePlan(plan)}>Delete</button></td>
										</tr>
									))}
									{!isLoading && plans.length === 0 && <tr><td className="empty-users" colSpan="7">No plans yet. Create your first plan to get started.</td></tr>}
									{isLoading && <tr><td className="empty-users" colSpan="7">Loading plans…</td></tr>}
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
